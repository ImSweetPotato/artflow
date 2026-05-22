# ArtFlow



## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/ee/gitlab-basics/add-file.html#add-a-file-using-the-command-line) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://git.sofunny.io/lujinjin/artflow.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://git.sofunny.io/lujinjin/artflow/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Automatically merge when pipeline succeeds](https://docs.gitlab.com/ee/user/project/merge_requests/merge_when_pipeline_succeeds.html)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/index.html)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing(SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Editing this README

When you're ready to make this README your own, just edit this file and use the handy template below (or feel free to structure it however you want - this is just a starting point!). Thank you to [makeareadme.com](https://www.makeareadme.com/) for this template.

## Suggestions for a good README
Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.
# ArtFlow 快速上手

ArtFlow 是一个内部 AI 图片创作工作台，包含 Next.js 前端和 FastAPI 后端。前端负责登录、任务提交、灵感库、创作流程页面和任务结果展示；后端负责鉴权、任务队列、技能路由、图片生成服务调用、文件上传与结果下载。

## 技术栈

- 前端：Next.js 16、React 19、TypeScript、Tailwind CSS、Axios
- 后端：FastAPI、Uvicorn、SQLAlchemy、SQLite、本地任务队列
- 生成服务：Sofunny Gemini / GPT-Image-2、Volcano Seedream、ComfyUI、LLM 代理
- 登录：飞书 OAuth

## 目录结构

```text
artflow/
  backend/                 # FastAPI 后端
    main.py                # API 入口，注册路由和静态目录
    database.py            # 数据库初始化
    models.py              # SQLAlchemy 模型
    routes/                # auth/tasks/skills/inspiration/admin 路由
    services/              # 队列、LLM、生图、凭据等服务
    skills/                # 具体创作技能实现
    outputs/               # 生成结果，本地运行时生成，不入库
    uploads/               # 上传文件，本地运行时生成，不入库
  frontend/                # Next.js 前端
    app/                   # 页面路由
    components/            # 通用组件
    contexts/              # React 上下文
    hooks/                 # 通用 hooks
    lib/                   # API、灵感库、教程等数据和工具
    public/                # 静态资源
  start-dev.bat            # 开发环境一键启动
  start-prod.bat           # 生产环境一键启动
  deploy.bat               # dev 合并 main 并构建前端
  WORKFLOW.md              # 分支和发布流程说明
```

## 环境准备

建议在 Windows 环境运行，项目脚本默认使用 `py`、`cmd` 和 `bat`。

需要提前安装：

- Python 3.10+
- Node.js 20+
- npm

首次拉取项目后安装依赖：

```bat
cd backend
py -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

cd ..\frontend
npm install
```

如果不使用 Python 虚拟环境，也可以直接在 `backend` 目录执行 `pip install -r requirements.txt`。

## 环境变量

后端读取 `backend/.env`，前端读取 `frontend/.env.local` 或 `frontend/.env.development.local`。

### 后端 `backend/.env`

```env
JWT_SECRET=change-me
ARTFLOW_API_KEY=optional-legacy-token

ANTHROPIC_API_KEY=your-llm-api-key
API_BASE_URL=https://your-llm-proxy.example.com/v1
THINKING_MODEL=gpt-5.4

VOLCANO_API_KEY=your-volcano-api-key

SOFUNNY_BASE_URL=https://your-sofunny-proxy.example.com
SOFUNNY_API_KEY=your-sofunny-api-key
SOFUNNY_MODEL=gemini-3.1-flash-image-preview
SOFUNNY_GPT_IMAGE_MODEL=gpt-image-2

COMFYUI_BASE_URL=http://your-comfyui-host:8188

FEISHU_APP_ID=your-feishu-app-id
FEISHU_APP_SECRET=your-feishu-app-secret
FEISHU_REDIRECT_URI=http://your-host:8001/auth/feishu/callback
FRONTEND_BASE_URL=http://your-host:3001

CREDENTIAL_ENCRYPTION_KEY=optional-random-secret
```

说明：

- `JWT_SECRET` 用于登录态签名，生产环境必须改成随机字符串。
- `ANTHROPIC_API_KEY` 和 `API_BASE_URL` 用于提示词、LLM 调用和部分技能。
- `SOFUNNY_*`、`VOLCANO_API_KEY`、`COMFYUI_BASE_URL` 决定具体图片生成后端是否可用。
- 飞书登录需要在飞书开放平台配置回调地址，且和 `FEISHU_REDIRECT_URI` 保持一致。

### 前端开发环境 `frontend/.env.development.local`

```env
NEXT_PUBLIC_API_URL=http://10.30.40.37:8001
NEXT_PUBLIC_ADMIN_CONTACT_URL=
```

### 前端生产环境 `frontend/.env.local`

```env
NEXT_PUBLIC_API_URL=http://10.30.40.37:8000
NEXT_PUBLIC_ADMIN_CONTACT_URL=
```

按实际部署机器修改 IP 和端口。前端环境变量变更后，需要重启前端进程；生产构建还需要重新 `npm run build`。

## 开发环境启动

推荐直接运行：

```bat
start-dev.bat
```

脚本会启动两个窗口：

- 后端：`http://10.30.40.37:8001`
- 前端：`http://10.30.40.37:3001`

也可以手动启动：

```bat
cd backend
py -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

```bat
cd frontend
npm run dev -- --webpack --port 3001
```

后端启动时会自动初始化 SQLite 数据库，并创建 `backend/outputs` 和 `backend/uploads` 目录。

## 生产环境启动

先构建前端：

```bat
cd frontend
npm run build
```

再回到项目根目录运行：

```bat
start-prod.bat
```

默认端口：

- 后端：`http://10.30.40.37:8000`
- 前端：`http://10.30.40.37:3000`

## 常用命令

```bat
:: 前端代码检查
cd frontend
npm run lint

:: 前端生产构建
cd frontend
npm run build

:: 后端开发启动
cd backend
py -m uvicorn main:app --host 0.0.0.0 --port 8001 --reload

:: 后端生产启动
cd backend
py -m uvicorn main:app --host 0.0.0.0 --port 8000
```

## 发布流程

项目约定：

- `dev`：日常开发分支
- `main`：稳定生产分支

发布前确认开发环境验证通过，然后在项目根目录运行：

```bat
deploy.bat
```

脚本会执行：

1. 切到 `main`
2. 合并 `dev`
3. 推送 `main`
4. 执行 `frontend\npm run build`
5. 提示手动重启生产服务

更完整的分支、发布和回滚流程见 `WORKFLOW.md`。

## 数据和文件

- 默认数据库文件：`backend/artflow.db`
- 上传文件：`backend/uploads/`
- 生成结果：`backend/outputs/`
- 下载接口：`GET /api/download?path=...`

这些运行时文件默认不入库。迁移或备份环境时，需要按需单独处理数据库、上传文件和生成结果。

## 常见问题

### 前端访问后接口报错

检查 `frontend/.env.development.local` 或 `frontend/.env.local` 的 `NEXT_PUBLIC_API_URL` 是否指向当前后端端口。开发环境通常是 `:8001`，生产环境通常是 `:8000`。

### 飞书登录跳转失败

检查三处是否一致：

- 飞书开放平台配置的回调地址
- `backend/.env` 的 `FEISHU_REDIRECT_URI`
- 后端实际可访问的地址和端口

### 改了 `.env` 没生效

后端 `.env` 变更后必须重启后端进程。前端 `.env*` 变更后必须重启前端进程；生产环境还要重新构建。

### 生成图片失败

优先检查：

- 对应 API Key 是否配置
- 代理地址是否可访问
- `backend/outputs` 是否可写
- 后端窗口里的具体错误日志

### 端口被占用

开发默认使用前端 `3001`、后端 `8001`；生产默认使用前端 `3000`、后端 `8000`。如果端口被占用，先关闭旧窗口，或手动换端口启动。


For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
