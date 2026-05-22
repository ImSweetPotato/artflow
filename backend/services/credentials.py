import base64
import hashlib
import os
from datetime import datetime

import httpx
from jose import jwe
from sqlalchemy.orm import Session

from models import UserApiCredential

SOFUNNY_PROVIDER = "sofunny"


def _credential_secret() -> bytes:
    raw = (
        os.getenv("CREDENTIAL_ENCRYPTION_KEY", "").strip()
        or os.getenv("JWT_SECRET", "artflow-jwt-secret-change-in-prod").strip()
    )
    return hashlib.sha256(raw.encode("utf-8")).digest()


def encrypt_api_key(api_key: str) -> str:
    token = jwe.encrypt(api_key.encode("utf-8"), _credential_secret(), algorithm="dir", encryption="A256GCM")
    return token.decode("utf-8") if isinstance(token, bytes) else token


def decrypt_api_key(payload: str) -> str:
    value = jwe.decrypt(payload, _credential_secret())
    return value.decode("utf-8") if isinstance(value, bytes) else value


def mask_api_key(api_key: str) -> str:
    if len(api_key) <= 8:
        return "*" * len(api_key)
    return f"{api_key[:3]}****{api_key[-3:]}"


def get_active_credential(
    db: Session,
    user_id: str,
    provider: str = SOFUNNY_PROVIDER,
) -> UserApiCredential | None:
    return (
        db.query(UserApiCredential)
        .filter(
            UserApiCredential.user_id == user_id,
            UserApiCredential.provider == provider,
            UserApiCredential.is_active.is_(True),
        )
        .first()
    )


def get_user_sofunny_api_key(db: Session, user_id: str) -> str | None:
    cred = get_active_credential(db, user_id, SOFUNNY_PROVIDER)
    if not cred:
        return None
    return decrypt_api_key(cred.encrypted_api_key)


def upsert_sofunny_credential(db: Session, user_id: str, api_key: str, verified: bool) -> UserApiCredential:
    cred = get_active_credential(db, user_id, SOFUNNY_PROVIDER)
    if not cred:
        cred = UserApiCredential(
            user_id=user_id,
            provider=SOFUNNY_PROVIDER,
            encrypted_api_key=encrypt_api_key(api_key),
            key_mask=mask_api_key(api_key),
            is_active=True,
            verified_at=datetime.utcnow() if verified else None,
        )
        db.add(cred)
    else:
        cred.encrypted_api_key = encrypt_api_key(api_key)
        cred.key_mask = mask_api_key(api_key)
        cred.is_active = True
        cred.verified_at = datetime.utcnow() if verified else None
        cred.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(cred)
    return cred


def remove_sofunny_credential(db: Session, user_id: str) -> None:
    cred = get_active_credential(db, user_id, SOFUNNY_PROVIDER)
    if not cred:
        return
    db.delete(cred)
    db.commit()


def validate_sofunny_api_key(api_key: str) -> tuple[bool, str | None]:
    base = os.getenv("SOFUNNY_BASE_URL", "http://127.0.0.1:3000").rstrip("/")
    v1 = base if base.endswith("/v1") else f"{base}/v1"
    try:
        resp = httpx.get(
            f"{v1}/models",
            headers={"Authorization": f"Bearer {api_key}"},
            timeout=15,
        )
    except Exception as exc:
        return False, f"验证请求失败：{exc}"

    if resp.status_code in (401, 403):
        return False, "SOFUNNY_API_KEY 无效或无权限"
    if 200 <= resp.status_code < 300:
        return True, None
    if resp.status_code == 404:
        # 某些兼容网关未实现 /models；这种情况不阻断保存，但不标记 verified。
        return True, "当前网关不支持在线校验，已保存但未完成强校验"
    return False, f"验证失败，状态码 {resp.status_code}"
