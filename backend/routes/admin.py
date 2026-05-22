from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models import FeaturedCase, User
from deps import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users/featured")
def admin_all_featured(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    """管理员：查看所有用户的私有精选收藏（不含公共精选）"""
    rows = (
        db.query(FeaturedCase, User.display_name)
        .outerjoin(User, FeaturedCase.user_id == User.id)
        .order_by(FeaturedCase.created_at.desc())
        .all()
    )
    result = []
    for row, display_name in rows:
        d = _row_to_dict(row)
        d["ownerName"] = display_name or "（未知用户）"
        result.append(d)
    return result


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
        "userId": r.user_id,
        "isPublic": r.is_public,
        "isFeatured": True,
        "folder": "",
    }
