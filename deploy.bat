@echo off
echo ============================
echo  ArtFlow 发布到生产
echo ============================

cd /d %~dp0

echo [1/4] 合并 dev 到 main...
git checkout main
git merge dev --no-ff --no-edit
if errorlevel 1 (
    echo 合并失败，请手动解决冲突后重试
    pause
    exit /b 1
)

echo [2/4] 推送 main 到远程...
git push origin main
if errorlevel 1 (
    echo 推送失败，请检查网络或权限
    pause
    exit /b 1
)

echo [3/4] 构建前端...
cd frontend
call npm run build
if errorlevel 1 (
    echo 构建失败，发布终止
    cd ..
    pause
    exit /b 1
)
cd ..

echo [4/4] 提示重启生产服务...
echo.
echo √ 代码已合并并推送，前端已构建
echo 请手动关闭旧的生产窗口（前端 :3000、后端 :8000），再运行 start-prod.bat
echo.
pause

