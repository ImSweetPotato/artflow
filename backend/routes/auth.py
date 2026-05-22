from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timedelta
from jose import jwt
import bcrypt
import httpx
import os
import secrets
import json
import base64
from urllib.parse import urlencode, urlsplit

from database import get_db
from models import User
from deps import get_current_user, JWT_SECRET, JWT_ALGORITHM
from services.credentials import (
    get_active_credential,
    remove_sofunny_credential,
    upsert_sofunny_credential,
    validate_sofunny_api_key,
)

router = APIRouter(prefix="/auth", tags=["auth"])

JWT_EXPIRE_DAYS = 30
FEISHU_AUTHORIZE_URL = "https://open.feishu.cn/open-apis/authen/v1/index"
FEISHU_APP_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal"
FEISHU_USER_ACCESS_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/access_token"
FEISHU_USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info"


class LoginIn(BaseModel):
    username: str
    password: str


class ChangePasswordIn(BaseModel):
    old_password: str
    new_password: str


class SofunnyKeyIn(BaseModel):
    api_key: str


def is_feishu_user(user: User) -> bool:
    return user.username.startswith("feishu:")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except Exception:
        return False


def create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire}, JWT_SECRET, algorithm=JWT_ALGORITHM)


def serialize_user(user: User, db: Session | None = None) -> dict:
    cred = get_active_credential(db, user.id) if db is not None else None
    return {
        "id": user.id,
        "username": user.username,
        "displayName": user.display_name,
        "isAdmin": user.is_admin,
        "authProvider": "feishu" if is_feishu_user(user) else "local",
        "hasSofunnyKey": cred is not None,
        "sofunnyKeyMask": cred.key_mask if cred else None,
    }


def get_feishu_config() -> tuple[str, str, str]:
    app_id = os.getenv("FEISHU_APP_ID", "").strip()
    app_secret = os.getenv("FEISHU_APP_SECRET", "").strip()
    redirect_uri = os.getenv("FEISHU_REDIRECT_URI", "").strip()
    if not app_id or not app_secret or not redirect_uri:
        raise HTTPException(status_code=503, detail="飞书登录尚未配置完成")
    return app_id, app_secret, redirect_uri


def normalize_frontend_base(raw: str | None) -> str:
    fallback = os.getenv("FRONTEND_BASE_URL", "http://localhost:3001").strip() or "http://localhost:3001"
    value = (raw or fallback).strip()
    try:
        parsed = urlsplit(value)
    except Exception:
        return fallback
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return fallback
    return f"{parsed.scheme}://{parsed.netloc}"


def encode_frontend_user_payload(user: dict) -> str:
    raw = json.dumps(user, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii")


def build_frontend_login_url(
    frontend_base: str,
    *,
    token: str | None = None,
    user_payload: dict | None = None,
    error: str | None = None,
) -> str:
    params: dict[str, str] = {}
    if token:
        params["feishu_token"] = token
    if user_payload:
        params["feishu_user"] = encode_frontend_user_payload(user_payload)
    if error:
        params["feishu_error"] = error
    query = f"?{urlencode(params)}" if params else ""
    return f"{frontend_base}/login{query}"


def encode_feishu_state(frontend_base: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=10)
    payload = {
        "frontend": frontend_base,
        "nonce": secrets.token_urlsafe(12),
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_feishu_state(state: str) -> str:
    payload = jwt.decode(state, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    return normalize_frontend_base(payload.get("frontend"))


async def fetch_feishu_user_info(code: str) -> dict:
    app_id, app_secret, _redirect_uri = get_feishu_config()
    async with httpx.AsyncClient(timeout=15.0) as client:
        app_token_resp = await client.post(
            FEISHU_APP_TOKEN_URL,
            json={"app_id": app_id, "app_secret": app_secret},
        )
        app_token_resp.raise_for_status()
        app_token_data = app_token_resp.json()
        app_access_token = app_token_data.get("app_access_token")
        if not app_access_token:
            raise HTTPException(status_code=502, detail="飞书应用鉴权失败")

        user_token_resp = await client.post(
            FEISHU_USER_ACCESS_TOKEN_URL,
            json={
                "grant_type": "authorization_code",
                "code": code,
                "app_id": app_id,
                "app_secret": app_secret,
            },
            headers={"Authorization": f"Bearer {app_access_token}"},
        )
        user_token_resp.raise_for_status()
        user_token_data = user_token_resp.json().get("data", {})
        user_access_token = user_token_data.get("access_token")
        if not user_access_token:
            raise HTTPException(status_code=502, detail="飞书用户鉴权失败")

        user_info_resp = await client.get(
            FEISHU_USER_INFO_URL,
            headers={"Authorization": f"Bearer {user_access_token}"},
        )
        user_info_resp.raise_for_status()
        user_info = user_info_resp.json().get("data", {})
        if not user_info:
            raise HTTPException(status_code=502, detail="飞书用户信息获取失败")
        return user_info


@router.post("/login")
def login(body: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    token = create_token(user.id)
    return {"token": token, "user": serialize_user(user, db)}


@router.get("/feishu/login")
def feishu_login(next: str | None = Query(default=None)):
    app_id, _app_secret, redirect_uri = get_feishu_config()
    frontend_base = normalize_frontend_base(next)
    state = encode_feishu_state(frontend_base)
    auth_url = f"{FEISHU_AUTHORIZE_URL}?{urlencode({
        'app_id': app_id,
        'redirect_uri': redirect_uri,
        'state': state,
    })}"
    return RedirectResponse(auth_url, status_code=302)


@router.get("/feishu/callback")
async def feishu_callback(
    code: str = "",
    state: str = "",
    db: Session = Depends(get_db),
):
    frontend_base = normalize_frontend_base(None)
    if state:
        try:
            frontend_base = decode_feishu_state(state)
        except Exception:
            return RedirectResponse(build_frontend_login_url(frontend_base, error="飞书登录状态已失效，请重试"), status_code=302)
    if not code:
        return RedirectResponse(build_frontend_login_url(frontend_base, error="飞书登录失败，未收到授权码"), status_code=302)

    try:
        user_info = await fetch_feishu_user_info(code)
    except HTTPException as exc:
        return RedirectResponse(build_frontend_login_url(frontend_base, error=str(exc.detail)), status_code=302)
    except Exception:
        return RedirectResponse(build_frontend_login_url(frontend_base, error="飞书登录失败，请稍后重试"), status_code=302)

    stable_id = (
        user_info.get("union_id")
        or user_info.get("open_id")
        or user_info.get("user_id")
    )
    if not stable_id:
        return RedirectResponse(build_frontend_login_url(frontend_base, error="飞书未返回可用的用户标识"), status_code=302)

    display_name = (
        user_info.get("name")
        or user_info.get("en_name")
        or user_info.get("email")
        or "飞书用户"
    )
    username = f"feishu:{stable_id}"
    user = db.query(User).filter(User.username == username).first()
    if not user:
        user = User(
            username=username,
            password_hash=hash_password(secrets.token_urlsafe(24)),
            display_name=display_name,
            is_admin=False,
        )
        db.add(user)
    else:
        user.display_name = display_name
    db.commit()
    db.refresh(user)

    token = create_token(user.id)
    return RedirectResponse(
        build_frontend_login_url(frontend_base, token=token, user_payload=serialize_user(user, db)),
        status_code=302,
    )


@router.get("/me")
def get_me(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return serialize_user(current_user, db)


@router.post("/sofunny-key")
def save_sofunny_key(
    body: SofunnyKeyIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    api_key = body.api_key.strip()
    if not api_key:
        raise HTTPException(status_code=400, detail="请输入 SOFUNNY_API_KEY")
    if not api_key.startswith("sk-"):
        raise HTTPException(status_code=400, detail="SOFUNNY_API_KEY 格式不正确，必须以 sk- 开头")
    ok, message = validate_sofunny_api_key(api_key)
    if not ok:
        raise HTTPException(status_code=400, detail=message or "SOFUNNY_API_KEY 验证失败")
    cred = upsert_sofunny_credential(db, current_user.id, api_key, verified=message is None)
    return {
        "ok": True,
        "mask": cred.key_mask,
        "message": message or "SOFUNNY_API_KEY 已绑定",
        "user": serialize_user(current_user, db),
    }


@router.delete("/sofunny-key")
def delete_sofunny_key(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    remove_sofunny_credential(db, current_user.id)
    return {"ok": True, "user": serialize_user(current_user, db)}


@router.post("/change-password")
def change_password(
    body: ChangePasswordIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if is_feishu_user(current_user):
        raise HTTPException(status_code=400, detail="飞书登录账号不支持修改本地密码")
    if not verify_password(body.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="原密码不正确")
    if len(body.new_password) < 4:
        raise HTTPException(status_code=400, detail="新密码至少 4 位")
    if body.old_password == body.new_password:
        raise HTTPException(status_code=400, detail="新密码不能与原密码相同")
    current_user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"ok": True}
