# 数据库设计范式说明

## 概述
本项目数据库设计严格遵守数据库三大范式（1NF、2NF、3NF），确保数据完整性、减少冗余、提高维护性。

## 第一范式 (1NF) - 原子性
**要求：** 所有字段都是原子值，不可再分。

### 修复内容
**问题：** `ai_analyses` 表的 `message_ids` 字段存储逗号分隔的ID列表
```sql
-- ❌ 违反1NF
message_ids TEXT NOT NULL  -- 例如："1,2,3,4"
```

**解决方案：** 创建关联表 `ai_analysis_messages`
```sql
-- ✅ 符合1NF
CREATE TABLE ai_analysis_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id INTEGER NOT NULL,
  message_id INTEGER NOT NULL,  -- 每个消息ID独立存储
  FOREIGN KEY (analysis_id) REFERENCES ai_analyses(id),
  FOREIGN KEY (message_id) REFERENCES messages(id),
  UNIQUE(analysis_id, message_id)
);
```

## 第二范式 (2NF) - 完全依赖
**要求：** 满足1NF，且所有非主键字段完全依赖于主键（不存在部分依赖）。

### 设计示例
所有表都使用单一主键（`id`），非主键字段完全依赖于主键。

```sql
-- ✅ 符合2NF
CREATE TABLE project_members (
  id INTEGER PRIMARY KEY,        -- 单一主键
  project_id INTEGER NOT NULL,   -- 完全依赖于id
  user_id INTEGER NOT NULL,      -- 完全依赖于id
  role TEXT,                     -- 完全依赖于id
  joined_at DATETIME             -- 完全依赖于id
);
```

## 第三范式 (3NF) - 消除传递依赖
**要求：** 满足2NF，且所有非主键字段之间不存在传递依赖。

### 修复内容
**问题：** `files` 表使用多态关联（related_type + related_id）
```sql
-- ❌ 违反3NF（存在传递依赖）
CREATE TABLE files (
  id INTEGER PRIMARY KEY,
  related_type TEXT,  -- 'message', 'document', 'avatar'
  related_id INTEGER  -- 依赖于related_type确定关联的表
);
```

**解决方案：** 为每种关联类型创建独立的关联表
```sql
-- ✅ 符合3NF
CREATE TABLE message_attachments (
  id INTEGER PRIMARY KEY,
  message_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  FOREIGN KEY (message_id) REFERENCES messages(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE TABLE document_attachments (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
);

CREATE TABLE user_avatars (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  is_current BOOLEAN DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (file_id) REFERENCES files(id)
);
```

## 数据表设计检查清单

### ✅ 符合范式的表设计

1. **users** - 用户表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

2. **friendships** - 好友关系表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

3. **projects** - 项目表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: creator_id 和 owner_id 虽然都关联 users，但各有独立业务含义（创建者vs当前所有者），不违反3NF

4. **project_members** - 项目成员表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

5. **chats** - 聊天表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

6. **chat_members** - 聊天成员表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

7. **messages** - 消息表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

8. **tasks** - 任务表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

9. **bugs** - 缺陷表
   - ✅ 1NF: 所有字段原子化
   - ✅ 2NF: 字段完全依赖主键
   - ✅ 3NF: 无传递依赖

10. **documents** - 文档表
    - ✅ 1NF: 所有字段原子化
    - ✅ 2NF: 字段完全依赖主键
    - ✅ 3NF: 无传递依赖

11. **repositories** - 代码仓库表
    - ✅ 1NF: 所有字段原子化
    - ✅ 2NF: 字段完全依赖主键
    - ✅ 3NF: 无传递依赖

## 索引设计

为了提高查询性能，在满足范式的基础上创建了合理的索引：

1. **外键索引** - 所有外键列都创建了索引
2. **查询字段索引** - 常用查询字段（如 status, type）创建了索引
3. **联合索引** - 对于常用的联合查询创建了联合索引
4. **唯一索引** - 对于需要保证唯一性的字段组合创建了唯一约束

## 数据完整性约束

1. **主键约束** - 所有表都有自增主键
2. **外键约束** - 所有关联字段都定义了外键约束
3. **非空约束** - 必填字段使用 NOT NULL
4. **检查约束** - 枚举类型使用 CHECK 约束
5. **唯一约束** - 防止重复数据

## 迁移策略

对于已有数据库的迁移：
1. 创建新的规范化表
2. 迁移现有数据到新表
3. 删除旧表结构
4. 重建索引

详见：`migrations/001_normalize_schema.sql`

## 性能优化

虽然严格遵守范式，但也考虑了性能：
1. 保留必要的冗余字段（如 projects.owner_id）用于提高查询性能
2. 创建合适的索引
3. 使用 UNIQUE 约束防止重复数据

## 总结

本数据库设计：
- ✅ 完全符合第一范式（1NF）- 原子性
- ✅ 完全符合第二范式（2NF）- 完全依赖
- ✅ 完全符合第三范式（3NF）- 消除传递依赖
- ✅ 保证数据完整性
- ✅ 减少数据冗余
- ✅ 提高可维护性
- ✅ 兼顾查询性能
