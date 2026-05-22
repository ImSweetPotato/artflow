@echo off
echo ============================
echo  ArtFlow 开发环境启动
echo  前端 :3001  后端 :8001
echo ============================

:: 后端（开发用独立端口，读同一份代码但可改 .env 指向 dev db）
start "ArtFlow Backend [DEV]" cmd /k "cd /d %~dp0backend && set PORT=8001 && py -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

timeout /t 3 /nobreak >nul

:: 前端（dev server，热更新，使用 webpack 避免 Turbopack 下样式产物与生产模式不一致）
start "ArtFlow Frontend [DEV]" cmd /k "cd /d %~dp0frontend && npm run dev -- --webpack --port 3001"

echo.
echo 开发环境已启动，访问 http://10.30.40.37:3001
echo 注意：开发前端默认读取 frontend/.env.development.local，并指向 :8001
