import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.orm import Session
from pathlib import Path

from database import get_db
from models import Task, TaskLog, User
from services.queue import enqueue, get_capacity_error
from deps import get_current_user
from services.credentials import get_active_credential

router = APIRouter(prefix="/tasks", tags=["tasks"])

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)


def _client_ip(request: Request) -> str:
    """取客户端 IP，优先反向代理头。"""
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip()
    return request.client.host if request.client else ""


def _user_nickname(request: Request) -> str | None:
    """取用户自定义昵称（共享账号场景下定位到具体使用者）。"""
    val = request.headers.get("x-user-nickname")
    if val:
        # 防御：限长 + strip
        return val.strip()[:64] or None
    return None


def _task_access_query(db: Session, current_user: User):
    q = db.query(Task)
    if not current_user.is_admin:
        q = q.filter(Task.user_id == current_user.id)
    return q


def _serialize_task(task: Task, owner: User | None = None) -> dict:
    return {
        "id": task.id,
        "skill_id": task.skill_id,
        "user_id": task.user_id,
        "status": task.status,
        "input_params": task.input_params,
        "output": task.output,
        "progress": task.progress,
        "retry_count": task.retry_count,
        "error_message": task.error_message,
        "created_by_ip": task.created_by_ip,
        "created_by_nickname": task.created_by_nickname,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "ownerDisplayName": owner.display_name if owner else None,
        "ownerUsername": owner.username if owner else None,
    }


def _apply_owner_filter(q, owner_filter: str, current_user: User):
    if not owner_filter or not current_user.is_admin:
        return q
    if owner_filter == "mine":
        return q.filter(Task.user_id == current_user.id)
    if owner_filter == "others":
        return q.filter(Task.user_id.isnot(None)).filter(Task.user_id != current_user.id)
    return q.filter(Task.user_id == owner_filter)


@router.post("")
def create_task(
    skill_id: str,
    request: Request,
    params: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if skill_id == "gptimage2" and not get_active_credential(db, current_user.id):
        raise HTTPException(status_code=400, detail="请先绑定个人 SOFUNNY_API_KEY")
    scheduled_at = (params or {}).get("scheduled_at")
    if not scheduled_at:
        capacity_error = get_capacity_error(db, current_user.id)
        if capacity_error:
            raise HTTPException(status_code=400, detail=capacity_error)
    task = Task(
        id=str(uuid.uuid4()),
        skill_id=skill_id,
        user_id=current_user.id,
        input_params=params or {},
        status="pending",
        created_by_ip=_client_ip(request),
        created_by_nickname=_user_nickname(request),
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    # 有 scheduled_at 的定时任务不立即入队，等调度器到期后处理
    if not scheduled_at:
        enqueue(task.id)
    return {"task_id": task.id, "status": task.status}


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    ext = Path(file.filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(400, "不支持的文件格式")
    file_id = str(uuid.uuid4())
    save_path = UPLOAD_DIR / f"{file_id}{ext}"
    save_path.write_bytes(await file.read())
    return {"file_id": file_id, "path": str(save_path)}


@router.get("")
def list_tasks(
    skip: int = 0,
    limit: int = 50,
    search: str = "",
    status: str = "",
    skill_ids: str = "",
    owner_filter: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = _task_access_query(db, current_user)
    q = _apply_owner_filter(q, owner_filter, current_user)
    if search:
        q = q.filter(Task.input_params["task_name"].as_string().contains(search))
    if status:
        q = q.filter(Task.status == status)
    if skill_ids:
        ids = [s.strip() for s in skill_ids.split(",") if s.strip()]
        if ids:
            q = q.filter(Task.skill_id.in_(ids))
    tasks = q.order_by(Task.created_at.desc()).offset(skip).limit(limit).all()
    owner_ids = sorted({task.user_id for task in tasks if task.user_id})
    owners = {}
    if owner_ids:
        owners = {
            user.id: user
            for user in db.query(User).filter(User.id.in_(owner_ids)).all()
        }
    return [_serialize_task(task, owners.get(task.user_id)) for task in tasks]


@router.get("/owners")
def list_task_owners(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not current_user.is_admin:
        return []
    rows = (
        db.query(User.id, User.display_name, User.username)
        .join(Task, Task.user_id == User.id)
        .distinct()
        .order_by(User.display_name.asc(), User.username.asc())
        .all()
    )
    return [
        {"id": user_id, "displayName": display_name, "username": username}
        for user_id, display_name, username in rows
    ]


@router.delete("/{task_id}")
def delete_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _task_access_query(db, current_user).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    db.query(TaskLog).filter(TaskLog.task_id == task_id).delete()
    db.delete(task)
    db.commit()
    return {"ok": True}


@router.get("/{task_id}")
def get_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _task_access_query(db, current_user).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    owner = db.query(User).filter(User.id == task.user_id).first() if task.user_id else None
    return _serialize_task(task, owner)


@router.get("/{task_id}/logs")
def get_task_logs(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _task_access_query(db, current_user).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    logs = db.query(TaskLog).filter(TaskLog.task_id == task_id).order_by(TaskLog.created_at).all()
    return logs


@router.post("/{task_id}/retry")
def retry_task(
    task_id: str,
    request: Request,
    options: dict = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = _task_access_query(db, current_user).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "任务不存在")
    if task.status not in ("failed",):
        raise HTTPException(400, "只有失败的任务可以重试")
    capacity_error = get_capacity_error(db, current_user.id, exclude_task_id=task_id)
    if capacity_error:
        raise HTTPException(status_code=400, detail=capacity_error)
    retry_mode = str((options or {}).get("mode") or "normal").strip().lower()
    next_params = dict(task.input_params or {})
    if retry_mode == "safety_rewrite":
        next_params["safety_rewrite_prompt"] = True
    else:
        next_params.pop("safety_rewrite_prompt", None)
    db.query(Task).filter(Task.id == task_id).update({
        "status": "pending",
        "progress": 0,
        "error_message": None,
        "retry_count": task.retry_count + 1,
        "input_params": next_params,
        "updated_at": datetime.utcnow(),
        # 重试也记一次实际触发的人
        "created_by_ip": _client_ip(request),
        "created_by_nickname": _user_nickname(request),
    })
    db.commit()
    enqueue(task_id)
    return {"task_id": task_id, "status": "pending"}
