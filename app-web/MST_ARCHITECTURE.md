# MST 状态管理架构说明

本项目采用 **MobX State Tree (MST)** 进行状态管理，架构遵循 **pages(jsx) - hooks(ts) - mst(model + action)** 的三层结构。

## 📁 项目结构

```
src/
├── stores/              # MST 状态管理层 (Model + Actions)
│   ├── UserStore.ts     # 用户状态管理
│   ├── ChatStore.ts     # 聊天状态管理
│   ├── MessageStore.ts  # 消息状态管理
│   ├── ProjectStore.ts  # 项目状态管理
│   ├── TaskStore.ts     # 任务状态管理
│   ├── RootStore.ts     # 根 Store
│   ├── StoreProvider.tsx # Store Provider
│   └── index.ts
│
├── hooks/               # 自定义 Hooks 层 (连接 Store 和组件)
│   ├── useUserStore.ts
│   ├── useChatStore.ts
│   ├── useMessageStore.ts
│   ├── useProjectStore.ts
│   ├── useTaskStore.ts
│   └── index.ts
│
└── pages/               # 页面组件层 (UI)
    ├── Login.tsx
    ├── Register.tsx
    ├── ChatPage.tsx     # 聊天页面示例
    └── ProjectsPage.tsx # 项目页面示例
```

## 🔧 架构层次

### 1️⃣ MST Store 层 (stores/)

负责定义数据模型、状态和业务逻辑。

**特点：**
- 使用 `types.model` 定义数据模型
- 使用 `.actions()` 定义同步操作
- 使用 `flow()` 定义异步操作
- 使用 `.views()` 定义计算属性

**示例：**
```typescript
// stores/ChatStore.ts
export const ChatStore = types
  .model('ChatStore', {
    chats: types.map(Chat),
    activeChat: types.maybeNull(types.reference(Chat)),
    isLoading: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    setActiveChat(chatId: number | null) {
      self.activeChat = chatId as any;
    },
  }))
  .actions((self) => ({
    fetchChats: flow(function* () {
      self.isLoading = true;
      try {
        const chats = yield chatApi.getChats();
        self.addChats(chats);
      } finally {
        self.isLoading = false;
      }
    }),
  }))
  .views((self) => ({
    get allChats() {
      return Array.from(self.chats.values());
    },
  }));
```

### 2️⃣ Hooks 层 (hooks/)

提供简洁的 API 让组件访问 Store。

**示例：**
```typescript
// hooks/useChatStore.ts
import { useRootStore } from '../stores';

export function useChatStore() {
  const { chatStore } = useRootStore();
  return chatStore;
}
```

### 3️⃣ Pages 层 (pages/)

React 组件，使用 hooks 访问状态和操作。

**关键点：**
- 使用 `observer` 包装组件使其响应式
- 通过 hooks 访问 store
- 调用 store 的 actions 改变状态

**示例：**
```typescript
// pages/ChatPage.tsx
import { observer } from 'mobx-react-lite';
import { useChatStore } from '../hooks/useChatStore';

export default observer(function ChatPage() {
  const chatStore = useChatStore();
  
  useEffect(() => {
    chatStore.fetchChats(); // 调用 action
  }, []);
  
  return (
    <div>
      {chatStore.allChats.map(chat => ( // 使用 computed view
        <div onClick={() => chatStore.setActiveChat(chat.id)}>
          {chat.name}
        </div>
      ))}
    </div>
  );
});
```

## 🚀 使用方法

### 1. 在组件中使用 Store

```typescript
import { observer } from 'mobx-react-lite';
import { useChatStore } from '../hooks';

export default observer(function MyComponent() {
  const chatStore = useChatStore();
  
  // 读取状态
  const chats = chatStore.allChats;
  const loading = chatStore.isLoading;
  
  // 调用 action
  const handleClick = () => {
    chatStore.setActiveChat(123);
  };
  
  // 调用异步 action
  const handleLoad = async () => {
    await chatStore.fetchChats();
  };
  
  return (
    <div>
      {loading ? '加载中...' : chats.map(...)}
    </div>
  );
});
```

### 2. 添加新的 Store

1. **创建 Store 模型** (`stores/MyStore.ts`)
```typescript
import { types, flow } from 'mobx-state-tree';

export const MyStore = types
  .model('MyStore', {
    items: types.array(types.frozen()),
    isLoading: types.optional(types.boolean, false),
  })
  .actions((self) => ({
    fetchItems: flow(function* () {
      self.isLoading = true;
      try {
        const data = yield api.getItems();
        self.items.replace(data);
      } finally {
        self.isLoading = false;
      }
    }),
  }));
```

2. **添加到 RootStore** (`stores/RootStore.ts`)
```typescript
import { MyStore } from './MyStore';

export const RootStore = types.model('RootStore', {
  // ... 其他 stores
  myStore: types.optional(MyStore, {}),
});
```

3. **创建 Hook** (`hooks/useMyStore.ts`)
```typescript
import { useRootStore } from '../stores';

export function useMyStore() {
  const { myStore } = useRootStore();
  return myStore;
}
```

4. **在组件中使用**
```typescript
import { observer } from 'mobx-react-lite';
import { useMyStore } from '../hooks';

export default observer(function MyPage() {
  const myStore = useMyStore();
  // ...
});
```

## 📚 核心概念

### observable 响应式数据
MST 中的所有 model 字段都是自动响应式的，无需手动标记。

### action 修改状态
只能通过 actions 修改状态，确保数据流清晰。

### flow 异步操作
使用 `flow()` 处理异步操作，类似于 async/await。

### views 计算属性
使用 `.views()` 定义派生状态，会自动缓存和更新。

### observer 响应式组件
用 `observer` 包装组件，当使用的 observable 数据变化时自动重新渲染。

## 🎯 最佳实践

1. **始终使用 observer 包装组件**
   ```typescript
   export default observer(function MyComponent() { ... });
   ```

2. **数据流是单向的**
   ```
   User Action → Component → Hook → Store Action → State Change → Component Re-render
   ```

3. **异步操作使用 flow**
   ```typescript
   fetchData: flow(function* () {
     const data = yield api.getData();
     self.data = data;
   })
   ```

4. **计算属性使用 views**
   ```typescript
   .views((self) => ({
     get filteredItems() {
       return self.items.filter(item => item.active);
     }
   }))
   ```

5. **类型安全**
   ```typescript
   export interface IMyStore extends Instance<typeof MyStore> {}
   ```

## 🔗 已集成的 Store

- ✅ **UserStore** - 用户管理 (登录、个人信息、搜索用户)
- ✅ **ChatStore** - 聊天管理 (聊天列表、创建聊天、切换聊天)
- ✅ **MessageStore** - 消息管理 (发送消息、获取消息、删除消息)
- ✅ **ProjectStore** - 项目管理 (CRUD 项目、成员管理)
- ✅ **TaskStore** - 任务管理 (CRUD 任务、状态管理)

## 📖 参考文档

- [MobX State Tree 官方文档](https://mobx-state-tree.js.org/)
- [MobX React 文档](https://mobx.js.org/react-integration.html)
