# DevChat API 简明文档

本文档以当前后端路由实现为准，基础前缀为 `/api`。

## 1. 通用说明

- 认证方式：`Authorization: Bearer <token>`
- 成功响应：

```json
{
  "success": true,
  "data": {}
}
```

- 失败响应：

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "错误说明"
  }
}
```

## 2. 认证

### `POST /auth/register`

- 注册
- 请求体：`username`、`password`，可带 `email`、`displayName`

### `POST /auth/login`

- 登录
- 返回用户信息和 token

### `POST /auth/refresh`

- 刷新登录态
- 需要已登录

### `POST /auth/logout`

- 退出登录

## 3. 用户与好友

### `GET /users/me`

- 获取当前用户资料

### `PUT /users/me`

- 更新当前用户资料

### `GET /users`

- 搜索或列出用户，支持 `q`

### `GET /users/me/friends`

- 获取我的好友列表

### `POST /users/me/friends`

- 发起好友请求
- 请求体：`userId`

### `PUT /users/friends/:friendshipId`

- 处理好友请求

### `DELETE /users/friends/:friendshipId`

- 删除好友关系

## 4. 聊天

### `GET /chats`

- 获取当前用户的聊天列表

### `POST /chats/direct`

- 创建或复用私聊
- 请求体：`targetUserId`

### `POST /chats/group`

- 创建群聊
- 请求体：`name`、`memberIds`

### `GET /chats/:chatId`

- 获取聊天详情

### `PUT /chats/:chatId`

- 更新群聊信息
- 请求体：`name`、`avatarUrl`

### `DELETE /chats/:chatId`

- 删除私聊，仅私聊可用

### `POST /chats/:chatId/leave`

- 退出群聊

### `POST /chats/:chatId/members`

- 添加群成员
- 请求体：`userId`

### `DELETE /chats/:chatId/members/:userId`

- 移除群成员

### `POST /chats/:chatId/read`

- 标记已读
- 请求体：`messageId`

## 5. 消息与附件

### `GET /chats/:chatId/messages`

- 获取消息列表
- 支持 `page`、`pageSize`、`before`

### `POST /chats/:chatId/messages`

- 发送消息
- 请求体：`content`、`type`、`replyToMessageId`

### `POST /chats/:chatId/messages/attachments`

- 上传附件
- `multipart/form-data`，字段名：`file`

### `GET /chats/attachments/:fileId`

- 下载附件

### `PUT /chats/messages/:messageId`

- 编辑消息

### `DELETE /chats/messages/:messageId`

- 删除消息

### `GET /chats/:chatId/messages/search`

- 搜索消息

## 6. 项目

### `GET /projects`

- 获取项目列表

### `POST /projects`

- 创建项目
- 请求体：`name`、`description`、`goal`、`content`、`timeline`

### `GET /projects/search`

- 搜索项目，参数：`q`

### `GET /projects/:projectId`

- 获取项目详情

### `PUT /projects/:projectId`

- 更新项目

### `DELETE /projects/:projectId`

- 删除项目

### `GET /projects/:projectId/members`

- 获取项目成员

### `POST /projects/:projectId/members`

- 添加项目成员
- 请求体：`userId`、`role`

### `PUT /projects/:projectId/members/:memberId`

- 更新项目成员角色

### `DELETE /projects/:projectId/members/:memberId`

- 移除项目成员

### `POST /projects/:projectId/chat/open`

- 打开项目群聊，不存在时自动创建

## 7. 任务

### `GET /projects/:projectId/tasks`

- 获取任务列表
- 支持 `status`、`priority`、`assigneeId`、`q`、`page`、`pageSize`

### `GET /projects/:projectId/tasks/:taskId`

- 获取任务详情

### `POST /projects/:projectId/tasks`

- 创建任务

### `PUT /projects/:projectId/tasks/:taskId`

- 更新任务

### `DELETE /projects/:projectId/tasks/:taskId`

- 删除任务

## 8. 缺陷

### `GET /projects/:projectId/bugs`

- 获取缺陷列表
- 支持 `status`、`severity`、`assigneeId`、`q`、`page`、`pageSize`

### `GET /projects/:projectId/bugs/:bugId`

- 获取缺陷详情

### `POST /projects/:projectId/bugs`

- 创建缺陷

### `PUT /projects/:projectId/bugs/:bugId`

- 更新缺陷

### `DELETE /projects/:projectId/bugs/:bugId`

- 删除缺陷

## 9. 文档

### `GET /projects/:projectId/documents`

- 获取文档列表
- 支持 `type`、`q`、`page`、`pageSize`

### `GET /projects/:projectId/documents/:documentId`

- 获取文档详情

### `POST /projects/:projectId/documents`

- 创建文档
- 请求体：`title`、`content`、`format`、`type`

### `PUT /projects/:projectId/documents/:documentId`

- 更新文档

### `DELETE /projects/:projectId/documents/:documentId`

- 删除文档

### `GET /projects/:projectId/documents/:documentId/comments`

- 获取文档评论

### `POST /projects/:projectId/documents/:documentId/comments`

- 新增评论

### `DELETE /projects/:projectId/documents/:documentId/comments/:commentId`

- 删除评论

## 10. 仓库

### `GET /projects/:projectId/repositories`

- 获取仓库列表
- 支持 `platform`、`isActive`

### `GET /projects/:projectId/repositories/:repositoryId/details`

- 获取仓库详情
- 当前返回 GitLab README、分支、Merge Requests

### `POST /projects/:projectId/repositories`

- 创建仓库
- 请求体：`name`、`url`、`platform`、`accessToken`、`isActive`

### `PUT /projects/:projectId/repositories/:repositoryId`

- 更新仓库

### `DELETE /projects/:projectId/repositories/:repositoryId`

- 删除仓库

## 11. 原型稿

### `GET /projects/:projectId/prototypes`

- 获取原型稿列表

### `GET /projects/:projectId/prototypes/:prototypeId`

- 获取原型稿详情，返回 `preview_url`

### `POST /projects/:projectId/prototypes`

- 上传原型稿
- `multipart/form-data`
- 文件字段：`archive`
- 其他字段：`name`、`description`

### `PUT /projects/:projectId/prototypes/:prototypeId`

- 更新原型稿，可重新上传 zip

### `DELETE /projects/:projectId/prototypes/:prototypeId`

- 删除原型稿

## 12. 健康检查与预览

### `GET /health`

- 健康检查

### `GET /prototype-preview/:previewKey/*`

- 原型静态预览地址
- 供浏览器直接访问，不走 `/api`
