from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

from database import get_db
from models import CustomCategory, FeaturedCase, ProjectCategory, User
from deps import get_current_user, require_admin

router = APIRouter(prefix="/inspiration", tags=["inspiration"])


# ── Custom Categories ──────────────────────────────────────────────────────────

class CategoryIn(BaseModel):
    key: str
    label: str


class ProjectCategoryIn(BaseModel):
    key: str
    label: str


@router.get("/categories")
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(CustomCategory)
        .filter(CustomCategory.user_id == current_user.id)
        .order_by(CustomCategory.sort_order, CustomCategory.created_at)
        .all()
    )
    return [{"key": r.key, "label": r.label} for r in rows]

@router.post("/categories")
def add_category(
    body: CategoryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(CustomCategory).filter(
        CustomCategory.key == body.key, CustomCategory.user_id == current_user.id
    ).first():
        raise HTTPException(400, "分类已存在")
    cat = CustomCategory(key=body.key, label=body.label.strip(), user_id=current_user.id)
    db.add(cat)
    db.commit()
    return {"key": cat.key, "label": cat.label}

@router.delete("/categories/{key}")
def delete_category(
    key: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cat = db.query(CustomCategory).filter(
        CustomCategory.key == key, CustomCategory.user_id == current_user.id
    ).first()
    if not cat:
        raise HTTPException(404, "分类不存在")
    db.delete(cat)
    db.commit()
    return {"ok": True}


@router.get("/project-categories")
def list_project_categories(db: Session = Depends(get_db)):
    rows = (
        db.query(ProjectCategory)
        .order_by(ProjectCategory.sort_order, ProjectCategory.created_at)
        .all()
    )
    return [{"key": r.key, "label": r.label} for r in rows]


@router.post("/project-categories")
def add_project_category(
    body: ProjectCategoryIn,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    key = body.key.strip()
    label = body.label.strip()
    if not key or not label:
        raise HTTPException(400, "分类不能为空")
    if db.query(ProjectCategory).filter(ProjectCategory.key == key).first():
        raise HTTPException(400, "项目分类已存在")
    if db.query(ProjectCategory).filter(ProjectCategory.label == label).first():
        raise HTTPException(400, "项目分类名称已存在")
    sort_order = db.query(ProjectCategory).count()
    row = ProjectCategory(key=key, label=label, sort_order=sort_order)
    db.add(row)
    db.commit()
    return {"key": row.key, "label": row.label}


@router.delete("/project-categories/{key}")
def delete_project_category(
    key: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    row = db.query(ProjectCategory).filter(ProjectCategory.key == key).first()
    if not row:
        raise HTTPException(404, "项目分类不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}


# ── Featured Cases ─────────────────────────────────────────────────────────────

class FeaturedIn(BaseModel):
    id: str
    category: str
    category_label: str
    title: str
    author: str = "我的精选"
    prompt: str
    image_url: str
    ref_image_url: str | None = None

class TitleIn(BaseModel):
    title: str


@router.get("/featured")
def list_public_featured(db: Session = Depends(get_db)):
    """公共精选（无需登录）——所有人可见"""
    rows = (
        db.query(FeaturedCase)
        .filter(FeaturedCase.is_public == True)  # noqa
        .order_by(FeaturedCase.created_at.desc())
        .all()
    )
    return [_row_to_dict(r) for r in rows]


@router.get("/featured/mine")
def list_my_featured(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """当前用户的私有收藏"""
    rows = (
        db.query(FeaturedCase)
        .filter(FeaturedCase.user_id == current_user.id)
        .order_by(FeaturedCase.created_at.desc())
        .all()
    )
    return [_row_to_dict(r) for r in rows]


@router.post("/featured")
def add_featured(
    body: FeaturedIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if db.query(FeaturedCase).filter(
        FeaturedCase.id == body.id, FeaturedCase.user_id == current_user.id
    ).first():
        raise HTTPException(400, "已存在")
    row = FeaturedCase(
        id=body.id,
        category=body.category,
        category_label=body.category_label,
        title=body.title,
        author=body.author,
        prompt=body.prompt,
        image_url=body.image_url,
        ref_image_url=body.ref_image_url,
        user_id=current_user.id,
        is_public=False,
    )
    db.add(row)
    db.commit()
    return _row_to_dict(row)


@router.patch("/featured/{id}/title")
def update_title(
    id: str,
    body: TitleIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(FeaturedCase).filter(
        FeaturedCase.id == id, FeaturedCase.user_id == current_user.id
    ).first()
    if not row:
        raise HTTPException(404, "不存在")
    row.title = body.title.strip() or row.title
    row.updated_at = datetime.utcnow()
    db.commit()
    return _row_to_dict(row)


@router.delete("/featured/{id}")
def delete_featured(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(FeaturedCase).filter(
        FeaturedCase.id == id, FeaturedCase.user_id == current_user.id
    ).first()
    if not row:
        raise HTTPException(404, "不存在")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.post("/featured/{id}/publish")
def publish_featured(
    id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """管理员：将某条精选设为公共可见"""
    row = db.query(FeaturedCase).filter(FeaturedCase.id == id).first()
    if not row:
        raise HTTPException(404, "不存在")
    row.is_public = True
    row.updated_at = datetime.utcnow()
    db.commit()
    return _row_to_dict(row)


@router.delete("/featured/{id}/publish")
def unpublish_featured(
    id: str,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """管理员：取消公共可见"""
    row = db.query(FeaturedCase).filter(FeaturedCase.id == id).first()
    if not row:
        raise HTTPException(404, "不存在")
    row.is_public = False
    row.updated_at = datetime.utcnow()
    db.commit()
    return _row_to_dict(row)


def _row_to_dict(r: FeaturedCase) -> dict:
    return {
        "id": r.id,
        "category": r.category,
        "categoryLabel": r.category_label,
        "title": r.title,
        "author": r.author,
        "prompt": r.prompt,
        "imageUrl": r.image_url,
        "refImageUrl": r.ref_image_url,
        "isPublic": r.is_public,
        "isFeatured": True,
        "folder": "",
    }
