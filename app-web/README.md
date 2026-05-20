# DevChat Frontend

前端工程，技术栈为 React + TypeScript + Vite。

## 环境要求

- Node.js 18+
- npm

## 开发启动

```bash
npm install
cp .env.example .env
npm run dev
```

默认地址：`http://localhost:5173`

## 环境变量

`.env` 常用项：

```bash
VITE_API_URL=http://localhost:3000/api
```

如果不配置 `VITE_API_URL`，前端会按当前浏览器主机名自动推断后端地址为 `:3000/api`。

## 常用命令

- `npm run dev`：启动开发服务
- `npm run build`：构建生产包
- `npm run preview`：预览构建结果
- `npm run lint`：TypeScript 检查

## 开发说明

- 路由入口：`src/routers/index.tsx`
- 聊天页：`src/pages/Chat/ChatPage.tsx`
- 项目详情页：`src/pages/Project/ProjectDetailPage.tsx`
- API 封装：`src/api/`
- 状态管理：`src/stores/`

## 联调说明

- 默认对接 `3000` 端口后端
- 局域网访问时，前端开发服务已监听 `0.0.0.0`
- 后端不在同一主机或端口时，修改 `VITE_API_URL`

## 相关文档

- `../doc/快速上手与部署说明.md`
- `../doc/交互文档.md`
- `../doc/API接口设计.md`
