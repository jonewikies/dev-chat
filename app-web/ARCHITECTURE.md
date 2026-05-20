# 前端架构重构说明

## 新目录结构

```
app-web/src/
├── routers/
│   └── index.tsx                 # 路由配置（使用 react-router-dom v6）
├── pages/
│   ├── Dashboard/
│   │   └── DashboardLayout.tsx   # 主布局组件
│   ├── Home/
│   │   └── HomePage.tsx          # 首页（欢迎页面）
│   ├── Login.tsx                 # 登录页
│   └── Register.tsx              # 注册页
├── components/
│   ├── Sidebar/
│   │   ├── Sidebar.tsx           # 侧边栏主组件
│   │   ├── SidebarHeader.tsx     # 侧边栏头部
│   │   ├── SearchBar.tsx         # 搜索栏
│   │   ├── ChatList.tsx          # 聊天列表
│   │   ├── ContactList.tsx       # 联系人列表
│   │   ├── ProjectList.tsx       # 项目列表
│   │   └── index.ts              # 导出文件
│   ├── DataLoader.tsx            # 数据加载组件
│   ├── ProjectModal.tsx          # 创建项目弹窗
│   └── ProtectedRoute.tsx        # 路由守卫
├── stores/                       # MobX State Tree 状态管理
├── hooks/                        # 自定义 Hooks
├── contexts/                     # React Contexts
└── api/                          # API 接口层
```

## 主要改动

### 1. 路由架构（router/index.tsx）

使用 `react-router-dom v6` 的 `createBrowserRouter` API：

```typescript
- 登录页：/login
- 注册页：/register
- 主应用：/ (需要认证)
  ├── 首页：/
  ├── 聊天：/chat/:chatId
  ├── 联系人：/contact/:userId
  ├── 项目：/project/:projectId
  └── 其他路由...
```

### 2. 组件拆分

#### Sidebar 组件系列
- **Sidebar.tsx**: 主侧边栏容器，使用 MobX `observer` 包装，响应式更新
- **SidebarHeader.tsx**: 头部组件（用户头像、标签切换、语言切换、新建菜单、退出登录）
- **SearchBar.tsx**: 搜索组件
- **ChatList.tsx**: 聊天列表（从 MST store 获取数据）
- **ContactList.tsx**: 联系人列表（从 MST store 获取数据）
- **ProjectList.tsx**: 项目列表（从 MST store 获取数据）

#### DataLoader 组件
负责在用户登录后自动加载初始数据：
- 项目列表
- 聊天列表
- 必要时加载用户数据

### 3. 状态管理集成

所有组件都使用了 MST (MobX State Tree) 进行状态管理：

```typescript
// 使用 hooks 访问 stores
const projectStore = useProjectStore();
const chatStore = useChatStore();
const userStore = useUserStore();

// 从 store 获取数据
const projects = Array.from(projectStore.projects.values());
const chats = Array.from(chatStore.chats.values());
```

### 4. API 集成

#### ProjectModal 更新
- 移除了手动填写 owner 字段
- 直接使用当前登录用户作为项目所有者
- 调用真实 API: `projectStore.createProject()`
- 添加了加载状态和错误处理

```typescript
await projectStore.createProject({
  name,
  description,
  goal,
  content,
  timeline,
});
```

## 技术栈

- **路由**: react-router-dom v6
- **状态管理**: MobX + mobx-state-tree + mobx-react-lite
- **UI**: Motion (framer-motion), Lucide React Icons
- **样式**: Tailwind CSS
- **类型**: TypeScript

## 数据流

```
用户操作
  ↓
React 组件 (observer)
  ↓
MST Store Actions
  ↓
API 调用
  ↓
Backend (Express + SQLite)
  ↓
响应数据
  ↓
MST Store 更新
  ↓
组件自动重渲染 (MobX 响应式)
```

## 待完成功能

### 页面组件
- [ ] ChatPage: 聊天页面（消息列表、发送消息、项目面板）
- [ ] ContactPage: 联系人详情页
- [ ] ProjectPage: 项目详情页（Overview、Tasks、Bugs、Docs）

### 功能增强
- [ ] 实时消息推送 (WebSocket)
- [ ] 分页加载
- [ ] 搜索功能实现
- [ ] 文件上传
- [ ] AI 功能集成

## 使用说明

### 启动项目

```bash
# 启动后端
cd server-web
npm run dev

# 启动前端
cd app-web
npm run dev
```

### 添加新路由

在 `routers/index.tsx` 中添加：

```typescript
{
  path: 'your-path/:param',
  element: <YourComponent />,
}
```

### 创建新页面组件

1. 在 `pages/` 下创建组件文件
2. 使用 `observer` 包装以支持 MobX 响应式
3. 通过 hooks 访问 stores
4. 在路由配置中注册

```typescript
import { observer } from 'mobx-react-lite';
import { useProjectStore } from '../../hooks';

const MyPage = observer(() => {
  const projectStore = useProjectStore();
  
  // 组件逻辑...
  
  return <div>...</div>;
});

export default MyPage;
```

## 注意事项

1. **observer 包装**: 所有使用 MST store 数据的组件都需要用 `observer` 包装
2. **路由导航**: 使用 `useNavigate` hook 进行编程式导航
3. **数据加载**: 数据加载逻辑在 `DataLoader` 组件中集中管理
4. **类型安全**: 所有组件和函数都有完整的 TypeScript 类型定义

## 性能优化

- 使用 `observer` 实现精确更新，只有使用到的数据变化时才重渲染
- 列表组件使用虚拟化（待实现）
- 懒加载路由组件
- API 请求去重和缓存（MST store 层面）
