# ArtFlow 开发发布流程规范

## 分支说明

| 分支 | 用途 | 对应环境 |
|------|------|----------|
| `main` | 稳定生产代码，只接受从 dev 合并 | 生产（:3000 / :8000） |
| `dev` | 日常开发迭代 | 开发（:3001 / :8001） |

---

## 一、日常开发流程

### 1. 确认当前在 dev 分支

```bash
git checkout dev
git pull origin dev   # 先拉最新，避免冲突
```

### 2. 开发 & 本地调试

启动开发环境（双击或命令行运行）：

```bash
start-dev.bat
```

- 前端热更新，访问 `http://10.30.40.37:3001`
- 后端 `--reload` 自动重载，端口 `8001`

### 3. 改完后提交

```bash
git add .
git commit -m "feat/fix/chore: 简短描述做了什么"
git push origin dev
```

**提交信息规范：**

| 前缀 | 含义 |
|------|------|
| `feat:` | 新功能 |
| `fix:` | Bug 修复 |
| `chore:` | 配置、脚本、依赖等杂项 |
| `style:` | 纯样式/UI 调整 |
| `refactor:` | 重构，不影响功能 |

---

## 二、发布到生产

> 确认在开发环境测试没问题后再执行

### 方式一：双击脚本（推荐）

```
deploy.bat
```

脚本自动完成：
1. 切到 `main` 分支
2. 合并 `dev`（带 `--no-ff` 保留合并节点）
3. 推送 `main` 到远程
4. 构建前端（`npm run build`）
5. 提示你重启生产服务

### 方式二：手动执行

```bash
# 1. 合并到 main
git checkout main
git merge dev --no-ff
git push origin main

# 2. 构建前端
cd frontend
npm run build
cd ..

# 3. 重启生产服务（关掉旧窗口再执行）
start-prod.bat
```

---

## 三、启动 / 重启服务

### 生产环境（用户访问）

```bash
start-prod.bat
# 前端 :3000 · 后端 :8000
```

### 开发环境（本地调试）

```bash
start-dev.bat
# 前端 :3001 · 后端 :8001
```

> **只改了后端代码**：关掉后端窗口重启即可，前端不用动  
> **只改了前端**：开发环境自动热更新；发布时需要重新 `npm run build`  
> **改了 `.env`**：必须重启对应后端进程才生效

---

## 四、环境配置文件

| 文件 | 说明 | 是否入库 |
|------|------|----------|
| `backend/.env` | 后端密钥、API Key | ❌ 不入库 |
| `frontend/.env.local` | 前端 API 地址（生产） | ❌ 不入库 |
| `frontend/env.dev.example` | 开发环境配置模板 | ✅ 入库 |

新机器部署时，参考 `env.dev.example` 手动创建对应的 `.env.local`。

---

## 五、完整流程示意

```
[本地 dev 分支开发]
       │
       ▼
  start-dev.bat 调试
       │
       ▼
  git commit + git push origin dev
       │
       ▼  （确认测试 OK）
  deploy.bat
       │
       ├─ git merge dev → main
       ├─ git push origin main
       ├─ npm run build
       └─ 提示重启
       │
       ▼
  start-prod.bat 重启生产
       │
       ▼
  用户访问 :3000 看到新版本
```

---

## 六、紧急回滚

如果发布后发现严重问题，回滚到上一个稳定版本：

```bash
git checkout main
git log --oneline          # 找到上一个好的 commit hash
git revert HEAD            # 撤销最近一次合并（推荐）
# 或
git reset --hard <hash>    # 强制回到某个版本（谨慎）

cd frontend && npm run build && cd ..
# 重启生产服务
```
