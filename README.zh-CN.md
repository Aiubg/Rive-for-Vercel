# Rivo

[English](./README.md) | [简体中文](./README.zh-CN.md)

一个基于 SvelteKit 和 AI SDK 构建的开源 AI 聊天机器人模板。

## 项目介绍

Rivo 是一个可扩展的全栈 AI 聊天应用模板，重点能力包括：

- 基于 AI SDK 的多模型供应商接入
- 现代前端技术栈：SvelteKit + Svelte 5 + Tailwind CSS
- 文件上传支持：`.txt`、`.md`、`.docx`、`.xlsx`
- 使用 Drizzle ORM + libsql（SQLite/Turso）进行会话持久化
- 内置中英文国际化（`zh-CN`、`en`）

## 启动指南

### 1. 环境要求

- Node.js `>= 20.19.0`
- pnpm `>= 10`

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

将 `.env.example` 复制为 `.env.local`，再填写真实密钥。

```bash
# macOS / Linux
cp .env.example .env.local

# PowerShell
Copy-Item .env.example .env.local
```

本地最小数据库配置示例：

```bash
LIBSQL_URL=file:./data/app.db
LIBSQL_AUTH_TOKEN=
```

项目默认聊天模型为 DeepSeek，请在 `.env.local` 中配置对应 API Key。

### 4. 准备数据库产物

```bash
pnpm db:generate
```

可选：使用脚本初始化本地 SQLite。

```bash
pnpm db:init-sqlite
```

### 5. 启动开发服务器

```bash
pnpm dev
```

浏览器访问 `http://localhost:5173`。

## 常用脚本

使用方式：`pnpm <script>`

- `dev`：启动本地开发服务
- `build`：构建生产包
- `preview`：本地预览生产构建结果
- `check`：执行 Svelte 与 TypeScript 检查
- `lint`：执行 Prettier 检查和 ESLint
- `test`：运行 Vitest 测试
- `db:generate`：生成 Drizzle 迁移产物
- `db:push`：推送 schema 到数据库
- `db:studio`：打开 Drizzle Studio

## 说明

- 请将密钥保存在 `.env.local`，不要提交到仓库。
- 本地开发推荐使用 `file:` 形式的 libsql 地址。
- 生产环境可使用 `libsql://...` 之类的远程 libsql 地址。
