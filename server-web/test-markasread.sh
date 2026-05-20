#!/bin/bash

cd /Users/wikies/www/dev-chat/server-web

# 登录获取 token
echo "登录 admin..."
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:3000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}' | jq -r '.data.token')

echo "Token: ${ADMIN_TOKEN:0:20}..."
echo ""

# 查看当前未读数
echo "调用 markAsRead 之前数据库状态:"
sqlite3 data/devchat.db "SELECT user_id, unread_count, last_read_message_id FROM chat_members WHERE chat_id = 1;"
echo ""

# 调用 markAsRead API
echo "调用 markAsRead API..."
RESPONSE=$(curl -s -X POST "http://localhost:3000/api/chats/1/read" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageId":999}')

echo "API 响应:"
echo "$RESPONSE" | jq .
echo ""

# 等待数据库保存
echo "等待2秒后检查数据库..."
sleep 2

# 查看更新后的未读数
echo "调用 markAsRead 之后数据库状态:"
sqlite3 data/devchat.db "SELECT user_id, unread_count, last_read_message_id FROM chat_members WHERE chat_id = 1;"
