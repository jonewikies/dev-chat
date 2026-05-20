# DevChat 生产环境部署说明

适用于把本仓库首次部署到生产服务器。

## 1. .gitignore 对生产部署的影响

仓库的 `.gitignore` 排除了以下内容，克隆后这些文件/目录**不存在**，必须在服务器上补充：

| 排除内容 | 说明 | 解决方式 |
|---|---|---|
| `server-web/dist/` | TypeScript 编译产物 | 服务器上执行 `npm run build` |
| `app-web/dist/` | 前端 Vite 构建产物 | 服务器上执行 `npm run build` |
| `server-web/.env` | 所有密钥和运行配置 | 从 `.env.example` 复制后填入真实值 |
| `server-web/data/` + `*.db` | SQLite 数据库文件 | 执行 `deploy/init-db.sh` 自动初始化 |
| `server-web/uploads/` | 用户上传文件目录 | 执行 `deploy/init-db.sh` 自动创建 |
| `server-web/logs/` | 运行日志目录 | 执行 `deploy/init-db.sh` 自动创建 |
| `package-lock.json` | npm 依赖版本锁文件 | 使用 `npm install`，版本由 `package.json` 的范围约束 |

> **注意**：`dist/` 不能从开发机直接拷贝到服务器。Node.js 原生模块（如 `sql.js`）存在平台差异，必须在目标系统上重新编译。
>
> 数据库初始化的可执行入口已经放在仓库跟踪的 `server-web/scripts/` 目录中，`dist/` 只作为构建产物和被调用的运行时代码，不再作为“脚本入口目录”。

## 2. 服务器环境要求

```
操作系统：Linux（推荐 Ubuntu 22.04 / Debian 12）
Node.js：18+（推荐通过 nvm 安装）
npm：9+
Nginx：用于反向代理和托管前端静态文件
PM2：Node.js 进程守护
```

安装 Node.js（推荐 nvm）：

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

安装 PM2 和 Nginx：

```bash
npm install -g pm2
sudo apt install -y nginx
```

## 3. 获取代码

```bash
cd /opt
git clone <your-repo-url> devchat
cd devchat
```

## 4. 配置后端环境变量

`.env` 被 `.gitignore` 排除，仓库只有 `.env.example` 模板，必须手动设置真实值。

```bash
cp server-web/.env.example server-web/.env
nano server-web/.env
```

生产环境必须修改以下字段：

```bash
NODE_ENV=production
PORT=3000

# 访问数据库路径（保持默认即可）
DATABASE_PATH=./data/devchat.db

# 前端真实访问域名，多个用英文逗号分隔
CORS_ORIGIN=https://your-domain.com

# JWT 签名密钥，随机字符串，不可泄漏
# 生成方式：openssl rand -base64 48
JWT_SECRET=<your-random-jwt-secret>

# 消息加密密钥，64 位十六进制字符串，不可泄漏
# 生成方式：openssl rand -hex 32
ENCRYPTION_KEY=<your-64-char-hex-key>
ENCRYPTION_KEY_VERSION=1

UPLOAD_DIR=./uploads
LOG_LEVEL=info
AI_AUTO_SUMMARY_ENABLED=false
GEMINI_API_KEY=
```

说明：

- `DATABASE_PATH`、`UPLOAD_DIR`、`LOG_DIR`、`PROTOTYPE_DIR` 这类相对路径，现在统一按 `server-web` 目录解析，不受执行命令时所在目录影响。

> **安全提示**：`JWT_SECRET` 和 `ENCRYPTION_KEY` 一旦确定后不要更改，否则现有用户 Token 和历史消息将无法解密。`.env` 文件权限建议设为 `600`：`chmod 600 server-web/.env`

## 5. 执行数据库初始化脚本

脚本会自动完成：创建运行时目录 → 校验密钥配置 → 安装依赖 → 编译 TypeScript → 调用 `server-web/scripts/` 下的初始化入口 → 初始化数据库结构 → 创建默认管理员。

```bash
cd /opt/devchat
bash deploy/init-db.sh
```

脚本执行后请确认以下文件和目录已生成：

```
server-web/dist/              ← TypeScript 编译产物
server-web/data/devchat.db    ← SQLite 数据库文件
server-web/data/backups/      ← 启动备份目录
server-web/uploads/           ← 上传文件目录
server-web/logs/              ← 日志目录
```

默认管理员账号：`admin` / `123456`，**首次登录后立即修改密码**。

开发环境如果需要批量创建测试用户并互为好友，可执行：

```bash
cd /opt/devchat/server-web
npm run seed-dev-users
```

这个脚本会读取仓库根目录的 `deploy/人员名单.md`，用其中的用户名和密码生成开发测试账号，并为这些账号建立双向好友关系。默认会写入 `server-web/.env` 中配置的 `DATABASE_PATH`，不需要额外手工传绝对路径。

如需核对是否已全部创建成功，可继续执行：

```bash
cd /opt/devchat/server-web
npm run verify-dev-users
```

如果希望一次完成“建库 + 默认管理员 + 开发测试用户 + 好友关系 + 校验”，可以直接执行：

```bash
cd /opt/devchat/server-web
npm run init-dev-data
```

这组脚本是幂等的，可以重复执行：已存在的开发账号不会重复创建，已存在的双向好友关系也不会重复插入。

注意：执行 `seed-dev-users` 或 `init-dev-data` 之前，先停止正在运行的开发后端进程（例如 `nodemon`、`ts-node ./src/server.ts`）。当前后端基于 `sql.js` 在内存中持有数据库并自动保存，如果服务还在运行，旧内存状态可能会把刚刚写入的开发测试数据覆盖掉。脚本现在会主动检测到这种情况并直接报错终止。

## 6. 启动后端服务

```bash
cd /opt/devchat/server-web
pm2 start dist/server.js --name devchat-server
pm2 save
pm2 startup   # 输出的命令需要以 sudo 执行一次，用于设置开机自启
```

验证后端正常运行：

```bash
curl http://127.0.0.1:3000/api/health
# 预期输出：{"success":true,"data":{"status":"ok",...}}
```

## 7. 构建前端

> **重要**：`VITE_API_URL` 会在 `npm run build` 时写死进产物，构建前必须确认值正确。

如果前后端同域（推荐）：

```bash
cd /opt/devchat/app-web
npm install
npm run build
# 构建产物在 app-web/dist/
```

如果前后端跨域，先创建环境文件：

```bash
cd /opt/devchat/app-web
cat > .env.production <<'EOF'
VITE_API_URL=https://your-domain.com/api
EOF
npm install
npm run build
```

## 8. 配置 Nginx

将前端 `dist` 目录复制到 Nginx 静态目录（或直接用 root 指向）：

```bash
sudo mkdir -p /var/www/devchat
sudo cp -r /opt/devchat/app-web/dist /var/www/devchat/app-web
```

写入 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/devchat
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端静态文件
    root /var/www/devchat/app-web;
    index index.html;

    # SPA 路由回退，刷新页面时不返回 404
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket 代理（聊天实时通信）
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

    # 原型稿预览（直接由后端服务提供）
    location /prototype-preview/ {
        proxy_pass http://127.0.0.1:3000/prototype-preview/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置并重载：

```bash
sudo ln -s /etc/nginx/sites-available/devchat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 9. 更新部署流程

代码有更新时，在服务器上执行：

```bash
cd /opt/devchat
git pull

# 重新编译后端并重启
cd server-web
npm install
npm run build
pm2 restart devchat-server

# 重新构建前端并替换静态文件
cd ../app-web
npm install
npm run build
sudo cp -r dist/. /var/www/devchat/app-web/
```

## 10. 验收清单

部署完成后逐项检查：

- [ ] `curl http://127.0.0.1:3000/api/health` 返回 `"status":"ok"`
- [ ] 浏览器能打开前端首页和登录页
- [ ] 使用 `admin / 123456` 可以登录（立即改密）
- [ ] 登录后接口请求落到 `/api`，没有跨域错误
- [ ] 聊天页面 WebSocket 成功连接（状态栏显示在线）
- [ ] 发送消息、删除消息功能正常
- [ ] 原型预览链接可以在新标签页访问
- [ ] 刷新非首页路由不返回 404

## 11. 常见问题

### 后端启动失败，报密钥配置错误

检查 `server-web/.env` 中 `JWT_SECRET` 和 `ENCRYPTION_KEY` 是否已填写真实值，不能保留 `.env.example` 中的占位符。

### 前端接口请求到了错误地址

`VITE_API_URL` 在 `npm run build` 时写死进产物。如果 API 地址不对，需要修改 `.env.production` 后重新 build，重新复制 `dist/` 到 Nginx 目录。

### 后端跨域失败

`server-web/.env` 中的 `CORS_ORIGIN` 必须和浏览器访问地址完全一致，包括协议（`http`/`https`）、域名和端口。

### WebSocket 无法连接

- 检查 Nginx 的 `/socket.io/` 代理是否配置了 `Upgrade` 和 `Connection` 头
- 检查防火墙是否放行了 Nginx 监听端口（80 / 443）

### 原型预览 404

- 检查 Nginx 是否配置了 `/prototype-preview/` 代理块
- 检查 `server-web/uploads/prototypes/` 目录是否存在且可写
