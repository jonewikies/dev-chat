# DevChat Backend

后端工程，技术栈为 Node.js + Express + TypeScript + SQLite(sql.js)。

## 环境要求

- Node.js 18+
- npm

## 开发启动

```bash
npm install
cp .env.example .env
npm run dev
```

默认地址：`http://localhost:3000`

健康检查：`http://localhost:3000/api/health`

## 数据库初始化

- 首次启动后端时，会按最新 `schema.sql` 自动初始化数据库
- 空库首次启动时，会自动初始化默认数据，例如默认管理员
- 如需手动执行：

```bash
npm run build
npm run init-db
npm run init-default-data
```

## 常用命令

- `npm run dev`：启动开发服务
- `npm run build`：编译 TypeScript
- `npm run start`：启动生产服务
- `npm run init-db`：按最新 schema 手动初始化数据库
- `npm run init-default-data`：手动初始化默认数据
- `npm run seed-dev-users`：按 `../deploy/人员名单.md` 创建开发测试用户并互为好友
- `npm run verify-dev-users`：校验开发测试用户和双向好友关系是否完整
- `npm run init-dev-data`：一次完成建库、默认管理员、开发测试用户与校验
- `npm run migrate-local-time -- --before="2026-03-11 18:30:00" --apply`：一次性把旧 UTC 时间批量转换为本机时区格式
- `npm run migrate-message-encryption -- --apply`：一次性把仍为明文存储的历史消息批量补加密
- `npm run rotate-message-encryption-key`：离线预演消息密钥轮换
- `npm test`：运行测试
- `npm run lint`：代码检查

说明：

- 这组开发初始化脚本默认使用 `server-web/.env` 中的 `DATABASE_PATH`，相对路径统一按 `server-web` 目录解析。
- 执行 `seed-dev-users` 或 `init-dev-data` 之前，先停止正在运行的后端开发服务；否则 `sql.js` 的自动保存可能覆盖刚写入的数据。

## 旧时间迁移

如果数据库里已经有历史数据，且这些时间是旧逻辑写入的 UTC 裸字符串，可以执行一次性迁移脚本：

```bash
npm run build
npm run migrate-local-time -- --before="2026-03-11 18:30:00"
npm run migrate-local-time -- --before="2026-03-11 18:30:00" --apply
```

说明：

- 第一次命令是预演，不落库
- 第二次加 `--apply` 后才会真正写入，并自动先备份数据库
- `--before` 应填写“切换到本地时区写入逻辑之前”的本地时间截止点，避免把已经是本地时区的新数据再次偏移
- 脚本会记录迁移标记，默认不会重复执行；如需强制重跑，可额外加 `--force`

## 环境变量

`.env` 常用项：

- `PORT`
- `DATABASE_PATH`
- `JWT_SECRET`
- `CORS_ORIGIN`
- `UPLOAD_DIR`
- `MAX_FILE_SIZE`
- `PROTOTYPE_MAX_ARCHIVE_SIZE`
- `PROTOTYPE_MAX_EXTRACTED_SIZE`
- `GEMINI_API_KEY`
- `GEMINI_ENABLED`（可选，测试环境默认关闭，其他环境默认开启）
- `GEMINI_MODEL`（可选，默认 `gemini-2.5-flash`）
- `GEMINI_TIMEOUT_MS`（可选）
- `ENCRYPTION_KEY`
- `ENCRYPTION_KEY_VERSION`

说明：

- 项目群聊 AI 总结会优先调用 Gemini。
- 当 `GEMINI_API_KEY` 未配置、请求超时或模型返回不可解析时，会自动回退到本地规则摘要。
- 消息内容现在默认采用服务端 `AES-256-GCM` 加密后落库，`ENCRYPTION_KEY` 需要在不同环境中显式配置。
- 运行时当前只支持一个激活中的消息密钥，因此密钥轮换必须采用“停机离线重加密 -> 更新运行时密钥 -> 再启动服务”的流程。
- 推荐使用 64 位十六进制密钥，例如 `openssl rand -hex 32` 生成的值。
- `ENCRYPTION_KEY_VERSION` 用于标记当前运行时写入消息所使用的密钥版本，默认值为 `1`。
- 如已有历史消息且希望离线确认迁移结果，可执行：

```bash
npm run build
npm run migrate-message-encryption
npm run migrate-message-encryption -- --apply
```

- 第一次命令为预演，不落库。
- 第二次加 `--apply` 后才会真正写入，并自动先备份数据库。

如需轮换消息密钥，完整流程见 [../doc/消息加密与密钥轮换方案.md](../doc/%E6%B6%88%E6%81%AF%E5%8A%A0%E5%AF%86%E4%B8%8E%E5%AF%86%E9%92%A5%E8%BD%AE%E6%8D%A2%E6%96%B9%E6%A1%88.md)。

开发环境下，后端默认允许：

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- 私网 IP 的 `:5173` 来源

## 开发说明

- 服务入口：`src/server.ts`
- 应用装配：`src/app.ts`
- 路由：`src/routes/`
- 控制器：`src/controllers/`
- 业务层：`src/services/`
- 数据访问层：`src/repositories/`
- 数据库 schema：`src/database/schema.sql`

## 相关文档

- `../doc/快速上手与部署说明.md`
- `../doc/API接口设计.md`
- `../doc/后端架构设计.md`
