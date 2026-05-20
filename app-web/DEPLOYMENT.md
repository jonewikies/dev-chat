# app-web 部署文档

`app-web` 是基于 `React + Vite` 的前端项目，产物为静态文件。生产环境通常通过 `Nginx` 托管，并把 `/api` 和 `/socket.io` 反向代理到后端 `server-web`。

## 1. 环境要求

- Node.js 18+
- npm 9+

## 2. 部署前准备

在前端目录执行：

```bash
cd app-web
npm install
cp .env.example .env
```

`.env` 至少确认以下变量：

```bash
VITE_API_URL=http://your-server:3000/api
```

说明：

- 生产环境建议显式配置 `VITE_API_URL`，不要依赖浏览器自动推断。
- WebSocket 地址会基于 `VITE_API_URL` 自动推导，无需单独配置。
- 如果前后端走同域名反向代理，也可以写成 `https://your-domain/api`。

## 3. 构建

```bash
cd app-web
npm run build
```

构建完成后，静态文件位于：

- `app-web/dist`

可选检查：

```bash
cd app-web
npm run preview -- --host 0.0.0.0 --port 4173
```

## 4. 部署方式

### 方式 A：Nginx 托管静态文件

将 `app-web/dist` 上传到服务器，例如：

- `/var/www/devchat/app-web/dist`

示例 Nginx 配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    root /var/www/devchat/app-web/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

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
}
```

### 方式 B：临时静态服务

只用于临时验证，不建议正式环境使用：

```bash
cd app-web
npm install
npm run build
npx serve dist -l 5173
```

## 5. 发布流程

```bash
cd app-web
npm install
cp .env.example .env
# 按实际环境修改 VITE_API_URL
npm run build
```

然后将 `dist` 目录同步到服务器静态目录，并重载 Nginx。

## 6. 联调与验收

发布后至少检查：

- 打开首页和登录页是否正常
- 登录后接口请求是否落到 `/api`
- 聊天页面 WebSocket 是否成功连接
- 刷新非首页路由时是否仍能返回 `index.html`
- 原型预览链接 `/prototype-preview/...` 是否可访问

## 7. 常见问题

### 接口请求到了错误地址

检查 `VITE_API_URL` 是否在构建前写入了正确值。Vite 会在构建时把变量固化进产物，构建后改服务器环境变量不会影响已生成的静态文件。

### 页面刷新 404

说明静态服务器没有配置 SPA 回退，需把未知路径回退到 `index.html`。

### WebSocket 连接失败

优先检查：

- Nginx 是否代理了 `/socket.io/`
- 反向代理是否设置了 `Upgrade` 和 `Connection`
- `VITE_API_URL` 的协议、域名、端口是否与实际部署一致
