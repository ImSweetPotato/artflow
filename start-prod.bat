@echo off
echo ============================
echo  ArtFlow 生产环境启动
echo  前端 :3000  后端 :8000
echo ============================

:: 后端
start "ArtFlow Backend [PROD]" cmd /k "cd /d %~dp0backend && py -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: 等待后端就绪
timeout /t 3 /nobreak >nul

:: 前端（需要已 build）
start "ArtFlow Frontend [PROD]" cmd /k "cd /d %~dp0frontend && npm run start -- --hostname 0.0.0.0 --port 3000"

echo.
echo 生产环境已启动，访问 http://10.30.40.37:3000
