import threading
import queue
from datetime import datetime
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Task, TaskLog
from skills import get_skill
from services.credentials import get_user_sofunny_api_key


MAX_CONCURRENT_TASKS = 15
MAX_CONCURRENT_TASKS_PER_USER = 5
QUEUE_RETRY_DELAY_SECONDS = 2
ACTIVE_SUBMISSION_STATUSES = ("pending", "running", "retrying")
ACTIVE_RUNNING_STATUSES = ("running", "retrying")
TERMINAL_STATUSES = ("succeeded", "failed")
SUPPLIER_HINT = "供应商资源紧张，生图平均耗时 3-7 分钟，偶发 500 报错，重试即可。"

task_queue = queue.Queue()
_worker_threads: list[threading.Thread] = []
_queued_task_ids: set[str] = set()
_queue_lock = threading.Lock()


def _log(db: Session, task_id: str, message: str, level: str = "INFO", source: str = "worker"):
    db.add(TaskLog(task_id=task_id, level=level, message=message, source=source))
    db.commit()


def _update_task(db: Session, task_id: str, **kwargs):
    kwargs["updated_at"] = datetime.utcnow()
    db.query(Task).filter(Task.id == task_id).update(kwargs)
    db.commit()


def _parse_scheduled_at(params: dict) -> datetime | None:
    """解析 input_params 中的 scheduled_at（格式 2026-04-30T12:00:00，本地时间无时区）"""
    sa = (params or {}).get("scheduled_at")
    if not sa:
        return None
    try:
        return datetime.fromisoformat(sa)
    except Exception:
        return None


def _capacity_hint(message: str) -> str:
    return f"{message} {SUPPLIER_HINT}"


def get_capacity_error(db: Session, user_id: str | None, *, exclude_task_id: str | None = None) -> str | None:
    active_query = db.query(Task).filter(Task.status.in_(ACTIVE_SUBMISSION_STATUSES))
    if exclude_task_id:
        active_query = active_query.filter(Task.id != exclude_task_id)
    global_active = active_query.count()
    if global_active >= MAX_CONCURRENT_TASKS:
        return _capacity_hint(
            f"当前生图任务已达全局并发上限（最多 {MAX_CONCURRENT_TASKS} 个），请等待部分任务完成后再试。"
        )
    if user_id:
        user_active = active_query.filter(Task.user_id == user_id).count()
        if user_active >= MAX_CONCURRENT_TASKS_PER_USER:
            return _capacity_hint(
                f"当前账号已达并发上限（最多 {MAX_CONCURRENT_TASKS_PER_USER} 个），请等待已有任务完成后再试。"
            )
    return None


def _requeue_later(task_id: str, delay_seconds: int = QUEUE_RETRY_DELAY_SECONDS):
    timer = threading.Timer(delay_seconds, lambda: enqueue(task_id))
    timer.daemon = True
    timer.start()


def _claim_execution_slot(db: Session, task_id: str) -> tuple[Task | None, bool]:
    with _queue_lock:
        task = db.query(Task).filter(Task.id == task_id).first()
        if not task or task.status not in ("pending", "retrying"):
            return None, False

        global_running = db.query(Task).filter(Task.status.in_(ACTIVE_RUNNING_STATUSES)).count()
        if global_running >= MAX_CONCURRENT_TASKS:
            return None, True

        if task.user_id:
            user_running = (
                db.query(Task)
                .filter(Task.user_id == task.user_id, Task.status.in_(ACTIVE_RUNNING_STATUSES))
                .count()
            )
            if user_running >= MAX_CONCURRENT_TASKS_PER_USER:
                return None, True

        _update_task(db, task_id, status="running", progress=0)
        return db.query(Task).filter(Task.id == task_id).first(), False


def _run_task(task_id: str):
    db = SessionLocal()
    try:
        task, should_requeue = _claim_execution_slot(db, task_id)
        if not task:
            if should_requeue:
                _requeue_later(task_id)
            return False

        _log(db, task_id, f"任务开始执行，skill: {task.skill_id}")

        skill_cls = get_skill(task.skill_id)
        if not skill_cls:
            _update_task(db, task_id, status="failed", error_message=f"未找到 skill: {task.skill_id}")
            _log(db, task_id, f"未找到 skill: {task.skill_id}", level="ERROR")
            return

        skill = skill_cls()

        def on_progress(pct: int, msg: str = ""):
            task_now = db.query(Task).filter(Task.id == task_id).first()
            if not task_now or task_now.status in TERMINAL_STATUSES:
                # 忽略旧 worker / 旧回调对已终态任务的污染
                return

            if pct == -1:
                if task_now.status not in ("pending", "running", "retrying"):
                    return
                _update_task(db, task_id, status="retrying")
                if msg:
                    _log(db, task_id, msg, level="WARN")
            else:
                if task_now.status == "retrying":
                    _update_task(db, task_id, status="running", progress=pct)
                elif task_now.status in ("pending", "running"):
                    _update_task(db, task_id, progress=pct)
                else:
                    return
                if msg:
                    _log(db, task_id, msg)

        runtime_context = {
            "sofunny_api_key": get_user_sofunny_api_key(db, task.user_id) if task.user_id else None,
        }
        output = skill.execute(task.input_params or {}, on_progress=on_progress, runtime_context=runtime_context)
        latest_task = db.query(Task).filter(Task.id == task_id).first()
        if not latest_task or latest_task.status in TERMINAL_STATUSES:
            return True
        _update_task(db, task_id, status="succeeded", progress=100, output=output)
        _log(db, task_id, "任务执行完成")
        return True

    except Exception as e:
        latest_task = db.query(Task).filter(Task.id == task_id).first()
        if latest_task and latest_task.status not in TERMINAL_STATUSES:
            _update_task(db, task_id, status="failed", error_message=str(e))
            _log(db, task_id, f"任务失败: {e}", level="ERROR")
        return True
    finally:
        db.close()


def _worker_loop():
    while True:
        task_id = task_queue.get()
        try:
            with _queue_lock:
                _queued_task_ids.discard(task_id)
            _run_task(task_id)
        finally:
            task_queue.task_done()


def _scheduler_loop():
    """每 30 秒扫描一次：将到期的定时 pending 任务入队"""
    while True:
        threading.Event().wait(30)
        db = SessionLocal()
        try:
            now = datetime.now()  # 本地时间，与 scheduled_at 对应
            pending = db.query(Task).filter(Task.status == "pending").all()
            for t in pending:
                sa = _parse_scheduled_at(t.input_params)
                if sa is not None and now >= sa:
                    enqueue(t.id)
                    _log(db, t.id, f"定时任务到期，入队执行（scheduled_at={sa}）")
        except Exception:
            pass
        finally:
            db.close()


def _recover_tasks():
    """启动时恢复：running 任务标记为失败；pending 任务中无 scheduled_at 或已到期的重新入队"""
    db = SessionLocal()
    try:
        stuck = db.query(Task).filter(Task.status.in_(ACTIVE_RUNNING_STATUSES)).all()
        for t in stuck:
            _update_task(db, t.id, status="failed", error_message="服务重启，任务中断，请重新执行")
            _log(db, t.id, "服务重启，任务中断", level="WARN")

        now = datetime.now()
        pending = db.query(Task).filter(Task.status == "pending").all()
        for t in pending:
            sa = _parse_scheduled_at(t.input_params)
            if sa is None:
                # 普通任务，直接入队
                enqueue(t.id)
            elif now >= sa:
                # 定时任务已到期
                enqueue(t.id)
            # else: 定时任务未到期，等调度器处理
    finally:
        db.close()


def start_worker():
    global _worker_threads
    _recover_tasks()
    if _worker_threads:
        return
    for _ in range(MAX_CONCURRENT_TASKS):
        worker = threading.Thread(target=_worker_loop, daemon=True)
        worker.start()
        _worker_threads.append(worker)
    threading.Thread(target=_scheduler_loop, daemon=True).start()


def enqueue(task_id: str):
    with _queue_lock:
        if task_id in _queued_task_ids:
            return False
        _queued_task_ids.add(task_id)
        task_queue.put(task_id)
        return True
