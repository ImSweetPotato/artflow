import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime, JSON, Boolean, ForeignKey, UniqueConstraint
from database import Base


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=gen_uuid)
    username = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    display_name = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class UserApiCredential(Base):
    __tablename__ = "user_api_credentials"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_provider"),)

    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)
    encrypted_api_key = Column(Text, nullable=False)
    key_mask = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    verified_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String, primary_key=True, default=gen_uuid)
    skill_id = Column(String, nullable=False)
    user_id = Column(String, nullable=True)  # NULL = legacy data
    status = Column(String, default="pending")  # pending/running/succeeded/failed
    input_params = Column(JSON, nullable=True)
    output = Column(JSON, nullable=True)
    progress = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    error_message = Column(Text, nullable=True)
    # 使用者追溯（共享账号场景下定位到具体使用者）
    created_by_ip = Column(String, nullable=True)         # 提交时的客户端 IP
    created_by_nickname = Column(String, nullable=True)   # 用户设置的显示昵称（前端 X-User-Nickname header）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(String, nullable=False)
    level = Column(String, default="INFO")  # INFO/WARN/ERROR
    message = Column(Text, nullable=False)
    source = Column(String, default="worker")
    created_at = Column(DateTime, default=datetime.utcnow)


class CustomCategory(Base):
    __tablename__ = "custom_categories"

    key = Column(String, primary_key=True)   # e.g. "custom_1234567890"
    label = Column(String, nullable=False)
    user_id = Column(String, nullable=True)  # NULL = legacy data
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class ProjectCategory(Base):
    __tablename__ = "project_categories"

    key = Column(String, primary_key=True)   # e.g. "project_xxx"
    label = Column(String, nullable=False)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class FeaturedCase(Base):
    __tablename__ = "featured_cases"

    id = Column(String, primary_key=True, default=gen_uuid)
    category = Column(String, nullable=False)
    category_label = Column(String, nullable=False)
    title = Column(String, nullable=False)
    author = Column(String, default="我的精选")
    prompt = Column(Text, nullable=False)
    image_url = Column(Text, nullable=False)       # 生成结果图 URL
    ref_image_url = Column(Text, nullable=True)    # 原始参考图 URL
    user_id = Column(String, nullable=True)        # NULL = legacy / admin
    is_public = Column(Boolean, default=False)     # True = 公共精选（所有人可见）
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
