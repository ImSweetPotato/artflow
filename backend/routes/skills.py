from fastapi import APIRouter
from skills import list_skills

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("")
def get_skills():
    return list_skills()
