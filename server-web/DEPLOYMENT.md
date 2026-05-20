# server-web 部署文档

说明：仓库中的后端目录实际为 `server-web`。如果你口头上称它为 `app-server`，对应的就是这个目录。

`server-web` 是基于 `Node.js + Express + TypeScript + sql.js(SQLite)` 的后端服务。数据库文件默认保存在本地文件系统，不依赖独立的 MySQL/PostgreSQL 服务。

## 1. 环境要求

- Node.js 18+
- npm 9+
- Linux 服务器建议额外安装 `nginx`

## 2. 目录与产物

后端关键目录：

- `server-web/dist`：TypeScript 编译产物
- `server-web/data`：SQLite 数据库目录
- `server-web/uploads`：上传文件目录
- `server-web/logs`：日志目录

默认数据库文件：

- `server-web/data/devchat.db`

## 3. 环境变量

在服务器执行：

```bash
cd server-web
npm install
cp .env.example .env
```

生产环境建议至少确认以下配置：

```bash
NODE_ENV=production
PORT=3000
API_PREFIX=/api
DATABASE_PATH=./data/devchat.db
JWT_SECRET=replace-with-a-random-secret
CORS_ORIGIN=https://your-domain.com
UPLOAD_DIR=./uploads
LOG_LEVEL=info
ENCRYPTION_KEY=replace-with-openssl-rand-hex-32
ENCRYPTION_KEY_VERSION=1
GEMINI_API_KEY=
AI_AUTO_SUMMARY_ENABLED=false
```

建议：

- `JWT_SECRET` 使用足够长的随机字符串。
- `ENCRYPTION_KEY` 使用 `openssl rand -hex 32` 生成的 64 位十六进制字符串。
- 生产环境不要沿用 `.env.example` 中的默认密钥占位值。
- `CORS_ORIGIN` 填前端实际访问域名；多个值用英文逗号分隔。

## 4. 构建

```bash
cd server-web
npm install
npm run build
```

构建后入口文件为：

- `server-web/dist/server.js`

## 5. 数据库初始化

### 默认行为

后端启动时会自动执行以下操作：

1. 按 `schema.sql` 初始化数据库结构。
2. 若已有旧库，则自动补齐兼容字段。
3. 空库首次启动时，自动创建默认管理员账号。
4. 启动时自动创建一份数据库备份。

因此多数情况下，首次上线只需要直接启动服务即可完成建库。

### 手动初始化

如果希望在正式启动前先手动建库和写入默认数据，可执行：

```bash
cd server-web
npm run build
npm run init-db
npm run init-default-data
```

### 默认账号

空库初始化后会创建默认管理员：

- 用户名：`admin`
- 密码：`123456`

首次登录后应立即修改密码。

### 数据库存储说明

- 当前数据库是本地 SQLite 文件，不需要额外安装数据库服务。
- 只要 `DATABASE_PATH` 指向的目录可写，服务就能自动创建数据库文件。
- 建议把 `data` 目录纳入备份策略。

## 6. 启动方式

### 直接启动

```bash
cd server-web
npm run build
npm run start
```

默认监听：

- HTTP API：`http://127.0.0.1:3000/api`
- WebSocket：`ws://127.0.0.1:3000`

### 使用 PM2

正式环境建议使用进程守护：

```bash
cd server-web
npm run build
pm2 start dist/server.js --name devchat-server
pm2 save
pm2 startup
```

更新发布时：

```bash
cd server-web
git pull
npm install
npm run build
pm2 restart devchat-server
```

## 7. Nginx 反向代理

如果前后端同域部署，建议由 Nginx 统一代理后端接口和 WebSocket：

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /socket.io/ {
    proxy_pass http://127.0.0.1:3000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /prototype-preview/ {
    proxy_pass http://127.0.0.1:3000/prototype-preview/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

## 8. 首次上线建议流程

```bash
cd server-web
npm install
cp .env.example .env
# 修改 .env
npm run build
npm run init-db
npm run init-default-data
pm2 start dist/server.js --name devchat-server
```

验收：

```bash
curl http://127.0.0.1:3000/api/health
```

同时检查：

- `data/devchat.db` 是否已生成
- `data/backups/` 是否生成启动备份
- `uploads/`、`logs/` 目录是否可写
- 使用默认管理员是否可以登录

## 9. 历史库迁移

如果部署的是旧版本升级，而不是全新空库，可能还需要执行一次离线迁移。

### 旧时间字段迁移

```bash
cd server-web
npm run build
npm run migrate-local-time -- --before="2026-03-11 18:30:00"
npm run migrate-local-time -- --before="2026-03-11 18:30:00" --apply
```

### 历史消息补加密

```bash
cd server-web
npm run build
npm run migrate-message-encryption
npm run migrate-message-encryption -- --apply
```

说明：

- 不加 `--apply` 时为预演。
- 加 `--apply` 后才会真正落库。
- 脚本执行前会自动备份数据库。

## 10. 备份与恢复

### 备份

至少备份以下内容：

- `server-web/data/devchat.db`
- `server-web/data/backups/`
- `server-web/uploads/`
- `server-web/.env`

### 恢复

恢复时停止后端进程，用备份文件替换 `DATABASE_PATH` 指向的数据库文件，再重新启动服务。

## 11. 常见问题

### 启动失败，提示密钥配置错误

检查 `JWT_SECRET` 和 `ENCRYPTION_KEY` 是否已按生产值配置，尤其不要保留示例占位符。

### 跨域失败

检查 `CORS_ORIGIN` 是否包含前端实际访问地址，协议、域名、端口都要匹配。

### 数据库文件没有生成

优先检查：

- `DATABASE_PATH` 路径是否正确
- 对应目录是否有写权限
- 服务是否真正完成启动

### 文件上传失败

检查 `UPLOAD_DIR` 是否存在且可写，Nginx 代理层也要允许足够大的请求体。
