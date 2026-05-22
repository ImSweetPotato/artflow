"""
给已有表添加 user_id / is_public 列，并将现有数据归属到第一个 admin 账号。
运行方式：python migrate.py
"""
import re
import sqlite3
import sys


DB_PATH = "artflow.db"


def column_exists(conn, table: str, column: str) -> bool:
    cursor = conn.execute(f"PRAGMA table_info({table})")
    return any(row[1] == column for row in cursor.fetchall())


def table_exists(conn, table: str) -> bool:
    row = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (table,),
    ).fetchone()
    return bool(row)


def make_project_key(label: str, used: set[str]) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", label.strip().lower())
    base = base.strip("_") or "project"
    key = f"project_{base}"
    index = 2
    while key in used:
        key = f"project_{base}_{index}"
        index += 1
    used.add(key)
    return key


def migrate():
    conn = sqlite3.connect(DB_PATH)
    try:
        # 获取第一个管理员 user_id
        row = conn.execute("SELECT id FROM users WHERE is_admin=1 LIMIT 1").fetchone()
        admin_id = row[0] if row else None

        # tasks: 加 user_id
        if not column_exists(conn, "tasks", "user_id"):
            conn.execute("ALTER TABLE tasks ADD COLUMN user_id TEXT")
            if admin_id:
                conn.execute("UPDATE tasks SET user_id=? WHERE user_id IS NULL", (admin_id,))
            print("tasks.user_id 列已添加")
        else:
            print("tasks.user_id 已存在，跳过")

        # tasks: 加使用者追溯字段
        if not column_exists(conn, "tasks", "created_by_ip"):
            conn.execute("ALTER TABLE tasks ADD COLUMN created_by_ip TEXT")
            print("tasks.created_by_ip 列已添加")
        else:
            print("tasks.created_by_ip 已存在，跳过")

        if not column_exists(conn, "tasks", "created_by_nickname"):
            conn.execute("ALTER TABLE tasks ADD COLUMN created_by_nickname TEXT")
            print("tasks.created_by_nickname 列已添加")
        else:
            print("tasks.created_by_nickname 已存在，跳过")

        # custom_categories: 加 user_id
        if not column_exists(conn, "custom_categories", "user_id"):
            conn.execute("ALTER TABLE custom_categories ADD COLUMN user_id TEXT")
            if admin_id:
                conn.execute("UPDATE custom_categories SET user_id=? WHERE user_id IS NULL", (admin_id,))
            print("custom_categories.user_id 列已添加")
        else:
            print("custom_categories.user_id 已存在，跳过")

        # featured_cases: 加 user_id + is_public
        if not column_exists(conn, "featured_cases", "user_id"):
            conn.execute("ALTER TABLE featured_cases ADD COLUMN user_id TEXT")
            if admin_id:
                conn.execute("UPDATE featured_cases SET user_id=? WHERE user_id IS NULL", (admin_id,))
            print("featured_cases.user_id 列已添加")
        else:
            print("featured_cases.user_id 已存在，跳过")

        if not column_exists(conn, "featured_cases", "is_public"):
            conn.execute("ALTER TABLE featured_cases ADD COLUMN is_public INTEGER DEFAULT 0")
            # 旧数据归属管理员的精选，默认设为公共
            if admin_id:
                conn.execute(
                    "UPDATE featured_cases SET is_public=1 WHERE user_id=?",
                    (admin_id,),
                )
            print("featured_cases.is_public 列已添加（旧数据设为公共精选）")
        else:
            print("featured_cases.is_public 已存在，跳过")

        # project_categories: 共享项目精选分类
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS project_categories (
                key TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        print("project_categories 表已检查/创建")

        # 从现有公共精选里反推项目分类，避免已有标签丢失
        existing_rows = conn.execute("SELECT key, label FROM project_categories").fetchall()
        existing_labels = {row[1] for row in existing_rows}
        used_keys = {row[0] for row in existing_rows}
        legacy_public_rows = conn.execute(
            """
            SELECT DISTINCT category, category_label
            FROM featured_cases
            WHERE is_public = 1
            ORDER BY updated_at DESC, created_at DESC
            """
        ).fetchall() if table_exists(conn, "featured_cases") else []

        inserted_count = 0
        updated_count = 0
        next_sort = len(existing_rows)
        for category, category_label in legacy_public_rows:
            label = (category_label or category or "").strip()
            category_key = (category or "").strip()
            if not label:
                continue
            existing_by_key = conn.execute(
                "SELECT key, label FROM project_categories WHERE key=?",
                (category_key,),
            ).fetchone() if category_key else None
            existing_by_label = conn.execute(
                "SELECT key, label FROM project_categories WHERE label=?",
                (label,),
            ).fetchone()

            if existing_by_key:
                if existing_by_key[1] != label:
                    conn.execute(
                        "UPDATE project_categories SET label=? WHERE key=?",
                        (label, category_key),
                    )
                    updated_count += 1
                existing_labels.add(label)
                used_keys.add(category_key)
                continue

            if existing_by_label and category_key and existing_by_label[0] != category_key:
                sort_row = conn.execute(
                    "SELECT sort_order, created_at FROM project_categories WHERE key=?",
                    (existing_by_label[0],),
                ).fetchone()
                conn.execute("DELETE FROM project_categories WHERE key=?", (existing_by_label[0],))
                conn.execute(
                    "INSERT INTO project_categories(key, label, sort_order, created_at) VALUES (?, ?, ?, ?)",
                    (category_key, label, sort_row[0] if sort_row else next_sort, sort_row[1] if sort_row else None),
                )
                updated_count += 1
                existing_labels.add(label)
                used_keys.add(category_key)
                continue

            if label in existing_labels:
                continue

            key = category_key or make_project_key(label, used_keys)
            conn.execute(
                "INSERT INTO project_categories(key, label, sort_order) VALUES (?, ?, ?)",
                (key, label, next_sort),
            )
            inserted_count += 1
            next_sort += 1
            existing_labels.add(label)
            used_keys.add(key)
        print(f"project_categories 已同步历史公共标签 {inserted_count} 条，修正 {updated_count} 条")

        # user_api_credentials
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS user_api_credentials (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                encrypted_api_key TEXT NOT NULL,
                key_mask TEXT NOT NULL,
                is_active INTEGER DEFAULT 1,
                verified_at DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS uq_user_provider ON user_api_credentials(user_id, provider)"
        )
        print("user_api_credentials 表已检查/创建")

        conn.commit()
        print("迁移完成。")
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
