# AI 对话总结与项目提案设计

本文档描述当前 DevChat 中已经落地的 AI 总结与项目提案架构，并说明与旧方案相比的关键调整。

## 1. 当前设计目标

系统当前目标不是“AI 自动改项目”，而是建立一条可审计的协作链路：

1. 从项目群聊中提取项目相关讨论
2. 生成一份可回看的沟通纪要草稿
3. 生成一组待负责人确认的项目内容提案
4. 负责人或成员先在 AI 管理页审阅，再决定是否 keep / undo

## 2. 关键设计原则

- AI 不直接写正式业务数据
- AI 输出必须是结构化结果，并经过服务端校验
- 正式写入任务、缺陷、文档、项目信息时必须复用已有服务层
- 沟通纪要和项目提案采用不同的确认策略：
  - 沟通纪要：先草稿，keep 后入文档
  - 项目提案：先 pending，keep 后入正式模块

## 3. 当前业务流程

### 3.1 手动总结流程

1. 用户进入项目群聊
2. 点击“AI 总结对话”
3. 在弹窗中选择总结范围：全部、今日、今日上午、今日下午、自定义范围
4. 前端展示当前范围的起始聊天记录与结束聊天记录
5. 前端将消息范围或时间范围传给后端
6. 后端读取该范围内消息，生成 AI 总结结果
7. 后端写入 `ai_analyses`
8. 后端生成项目内容提案并写入 `project_change_proposals`
9. 聊天流回写一条 `ai_summary` 类型消息
10. 用户进入项目 AI 管理页继续处理纪要草稿与提案

### 3.2 自动总结流程

1. 自动总结服务按配置轮询项目群聊
2. 若消息量达到阈值且不在冷却期内，则触发一次自动总结
3. 自动总结生成后仍进入相同的 AI 管理链路
4. 页面会标记该批次为“自动触发”

### 3.3 沟通纪要流程

与旧设计不同，当前实现已改为：

1. 总结阶段只生成 `archiveDocumentDraft`
2. 草稿先挂在 summary 记录上，不立即进入 `documents`
3. 成员在 AI 管理页点击“keep 沟通纪要”
4. 后端再调用 `ProjectService.createDocument` 创建正式项目文档

这样做的原因：

- 避免每次总结都自动在文档模块落一篇正式文档
- 让沟通纪要和提案一样，先审后入库
- 保持 AI 管理页对 AI 产物的统一处理体验

## 4. 输出结构

当前服务端要求 AI 结果满足结构化格式，核心字段包括：

- `overview`
- `highlights`
- `decisions`
- `projectUpdates`
- `archiveDocument`
  - `title`
  - `content`
  - `type`
- `proposals`
- `metadata`

### 4.1 提案字段

每条 proposal 当前至少包含：

- `targetType`
- `action`
- `title`
- `summary`
- `payload`
- `reason`
- `sourceMessageIds`
- `confidence`

### 4.2 元数据字段

当前 summary metadata 主要包含：

- `messageCount`
- `generatedAt`
- `provider`
- `triggerMode`

## 5. 数据模型

### 5.1 已复用表

- `messages`
- `ai_analyses`
- `documents`
- `tasks`
- `bugs`
- `projects`

### 5.2 提案表

当前系统通过 `project_change_proposals` 存储待确认提案。

除基础字段外，当前实现已补充原始草稿快照字段，便于后续 diff 回看：

- `original_title`
- `original_summary`
- `original_payload`
- `original_reason`

## 6. 核心后端组件

### 6.1 `ProjectAIService`

职责：

- 校验触发者权限
- 校验聊天必须是当前项目的项目群聊
- 按消息范围读取消息
- 调用 Gemini 或本地规则总结器
- 写入 AI 总结记录
- 生成 proposal
- keep 沟通纪要
- keep / undo proposal

### 6.2 `ProjectAIAutoSummaryService`

职责：

- 定时巡检项目群聊
- 基于阈值和冷却时间决定是否触发自动总结
- 复用 `ProjectAIService.summarizeProjectChat`

### 6.3 `MessageRepository.findByChatIdInRange`

职责：

- 根据消息 ID 范围和时间范围筛选消息
- 为 AI 总结提供可控的输入窗口
- 对传入的 ISO 时间做数据库本地时间格式转换，避免前后端时间格式不一致导致误筛空

## 7. 当前接口设计

### 7.1 创建总结

`POST /api/projects/:projectId/ai/summaries`

请求体当前支持：

```json
{
  "chatId": 12,
  "messageLimit": 100,
  "beforeMessageId": 456,
  "startMessageId": 700,
  "endMessageId": 820,
  "startTime": "2026-03-15T12:00:00+08:00",
  "endTime": "2026-03-15T18:00:00+08:00"
}
```

返回值当前为：

```json
{
  "analysisId": 15,
  "proposalCount": 4,
  "overview": "...",
  "archiveDocumentTitle": "AI对话归档-xxx"
}
```

注意：当前不会在这里直接返回正式 `archiveDocumentId`，因为沟通纪要还只是草稿。

### 7.2 keep 沟通纪要

`POST /api/projects/:projectId/ai/summaries/:analysisId/keep`

作用：

- 将 summary 上的纪要草稿转为项目正式文档
- 返回正式 `archiveDocumentId`

### 7.3 提案接口

当前主要接口：

- `GET /api/projects/:projectId/ai/proposals`
- `GET /api/projects/:projectId/ai/proposals/:proposalId`
- `POST /api/projects/:projectId/ai/proposals/:proposalId/keep`
- `POST /api/projects/:projectId/ai/proposals/:proposalId/undo`
- `POST /api/projects/:projectId/ai/summaries/:analysisId/retry`

## 8. 审批策略

### 8.1 提案审批

- 只有项目 `owner` 可以 keep / undo proposal
- keep 时可直接通过原始 proposal 入库
- 也可先编辑标题、摘要、reason、payload 后再 keep
- 批量 keep / undo 仍沿用单条接口逐条执行

### 8.2 沟通纪要 keep

- 当前实现允许项目成员 keep 沟通纪要草稿
- keep 后纪要进入项目文档管理模块

## 9. 当前产品边界

- 只有项目群聊会进入 AI 管理链路
- 普通群聊不生成项目提案
- AI 当前不支持删除类提案
- 沟通纪要 keep 与 proposal keep 不是同一动作，需要分别处理

## 10. 与旧设计相比的主要变化

- 从“总结后立即创建归档文档”改为“总结后先挂纪要草稿，keep 后再入文档”
- 从“只支持按条数抓取最近消息”扩展为“支持快捷时间范围 + 自定义时间范围”
- 从“只做手动总结”扩展为“支持自动总结”
- 从“只展示 proposal 列表”扩展为“支持批次分组、来源筛选、风险筛选、草稿 diff、已应用 diff”

## 11. 结论

当前 AI 设计已经从概念方案进入真实业务链路。关键特点是：总结范围可控、沟通纪要先草稿后入库、提案可解释且可审计、正式入库仍由项目业务服务层兜底。