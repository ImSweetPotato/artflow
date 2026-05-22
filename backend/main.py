from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from urllib.parse import quote
from dotenv import load_dotenv
import os

load_dotenv()

from database import init_db
from routes.tasks import router as tasks_router
from routes.skills import router as skills_router
from routes.inspiration import router as inspiration_router
from routes.auth import router as auth_router
from routes.admin import router as admin_router
from services.queue import start_worker

app = FastAPI(title="Sofunny ArtFlow", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*", "Authorization"],
)

app.include_router(auth_router)
app.include_router(tasks_router)
app.include_router(skills_router)
app.include_router(inspiration_router)
app.include_router(admin_router)

Path("outputs").mkdir(exist_ok=True)
app.mount("/outputs", StaticFiles(directory="outputs"), name="outputs")

Path("uploads").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")


@app.get("/api/download")
def download_file(path: str):
    outputs_root = Path("outputs").resolve()
    full_path = (outputs_root / path).resolve()
    try:
        full_path.relative_to(outputs_root)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied")
    if not full_path.exists() or not full_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        full_path,
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(full_path.name, safe='')}"},
    )


@app.on_event("startup")
def on_startup():
    init_db()
    start_worker()


@app.get("/")
def root():
    return {"name": "Sofunny ArtFlow API", "version": "1.0.0"}
