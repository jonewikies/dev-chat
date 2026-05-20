#!/bin/bash

# 测试未读消息计数功能 - 完整流程测试
# 场景：
# 1. admin 调用 markAsRead 清空未读数
# 2. wikies 发送新消息
# 3. admin 的未读数应该变成 1
# 4. 验证 API 返回正确的未读数

set -e

SERVER_URL="http://localhost:3000"
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BOLD}========================================${NC}"
echo -e "${BOLD}   未读消息列表功能测试${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""

# 1. 登录 admin 用户
echo -e "${YELLOW}[1/9]${NC} 登录 admin 用户..."
ADMIN_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"123456"}')

ADMIN_TOKEN=$(echo "$ADMIN_RESPONSE" | jq -r '.data.token')
ADMIN_ID=$(echo "$ADMIN_RESPONSE" | jq -r '.data.user.id')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}✗ admin 登录失败${NC}"
  echo "$ADMIN_RESPONSE" | jq .
  exit 1
fi
echo -e "${GREEN}✓ admin 登录成功 (ID: $ADMIN_ID)${NC}"
echo ""

# 2. 登录 wikies 用户
echo -e "${YELLOW}[2/9]${NC} 登录 wikies 用户..."
WIKIES_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"wikies","password":"123456"}')

WIKIES_TOKEN=$(echo "$WIKIES_RESPONSE" | jq -r '.data.token')
WIKIES_ID=$(echo "$WIKIES_RESPONSE" | jq -r '.data.user.id')

if [ "$WIKIES_TOKEN" == "null" ] || [ -z "$WIKIES_TOKEN" ]; then
  echo -e "${RED}✗ wikies 登录失败${NC}"
  echo "$WIKIES_RESPONSE" | jq .
  exit 1
fi
echo -e "${GREEN}✓ wikies 登录成功 (ID: $WIKIES_ID)${NC}"
echo ""

# 3. admin 调用 markAsRead 清空当前未读数
echo -e "${YELLOW}[3/9]${NC} admin 调用 markAsRead 清空未读数..."
MARK_READ_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/chats/1/read" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageId":0}')

MARK_READ_SUCCESS=$(echo "$MARK_READ_RESPONSE" | jq -r '.success')
if [ "$MARK_READ_SUCCESS" != "true" ]; then
  echo -e "${RED}✗ markAsRead 失败${NC}"
  echo "$MARK_READ_RESPONSE" | jq .
  exit 1
fi
echo -e "${GREEN}✓ markAsRead 调用成功${NC}"
echo ""

# 4. 等待数据库保存并验证未读数已清空
echo -e "${YELLOW}[4/9]${NC} 验证未读数已清空..."
sleep 1

ADMIN_CHATS=$(curl -s -X GET "$SERVER_URL/api/chats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_CHAT_1=$(echo "$ADMIN_CHATS" | jq '.data[] | select(.id == 1)')
ADMIN_MEMBER=$(echo "$ADMIN_CHAT_1" | jq ".members[] | select(.user_id == $ADMIN_ID)")
INITIAL_UNREAD=$(echo "$ADMIN_MEMBER" | jq -r '.unread_count')

if [ "$INITIAL_UNREAD" != "0" ]; then
  echo -e "${RED}✗ 未读数未清空 (实际: $INITIAL_UNREAD)${NC}"
  echo "$ADMIN_CHAT_1" | jq .
  exit 1
fi
echo -e "${GREEN}✓ 未读数已清空: $INITIAL_UNREAD${NC}"
echo ""

# 5. wikies 发送消息到 chat_id=1
echo -e "${YELLOW}[5/9]${NC} wikies 发送消息..."
MESSAGE_CONTENT="自动化测试消息-$(date +%s)"
SEND_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/chats/1/messages" \
  -H "Authorization: Bearer $WIKIES_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"$MESSAGE_CONTENT\",\"type\":\"text\"}")

SEND_SUCCESS=$(echo "$SEND_RESPONSE" | jq -r '.success')
if [ "$SEND_SUCCESS" != "true" ]; then
  echo -e "${RED}✗ 发送消息失败${NC}"
  echo "$SEND_RESPONSE" | jq .
  exit 1
fi

MESSAGE_ID=$(echo "$SEND_RESPONSE" | jq -r '.data.id')
echo -e "${GREEN}✓ 消息发送成功 (ID: $MESSAGE_ID, 内容: $MESSAGE_CONTENT)${NC}"
echo ""

# 6. 等待服务器处理并验证数据库中的未读数
echo -e "${YELLOW}[6/9]${NC} 验证数据库中的未读数..."
sleep 2  # 等待服务器处理和数据库保存

# 注意：我们不直接查询数据库文件，因为它会被内存数据库覆盖
echo -e "${GREEN}✓ 等待完成${NC}"
echo ""

# 7. 验证 API 返回的未读数 - GET /api/chats
echo -e "${YELLOW}[7/9]${NC} 验证 GET /api/chats 返回的未读数..."
ADMIN_CHATS_AFTER=$(curl -s -X GET "$SERVER_URL/api/chats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_CHAT_1_AFTER=$(echo "$ADMIN_CHATS_AFTER" | jq '.data[] | select(.id == 1)')
ADMIN_MEMBER_AFTER=$(echo "$ADMIN_CHAT_1_AFTER" | jq ".members[] | select(.user_id == $ADMIN_ID)")
API_UNREAD=$(echo "$ADMIN_MEMBER_AFTER" | jq -r '.unread_count')

if [ "$API_UNREAD" != "1" ]; then
  echo -e "${RED}✗ GET /api/chats 未读数不正确 (期望: 1, 实际: $API_UNREAD)${NC}"
  echo "完整 chat 数据:"
  echo "$ADMIN_CHAT_1_AFTER" | jq .
  exit 1
fi
echo -e "${GREEN}✓ GET /api/chats 未读数正确: $API_UNREAD${NC}"
echo ""

# 8. 验证 API 返回的未读数 - GET /api/chats/1
echo -e "${YELLOW}[8/9]${NC} 验证 GET /api/chats/1 返回的未读数..."
CHAT_DETAIL=$(curl -s -X GET "$SERVER_URL/api/chats/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CHAT_DETAIL_DATA=$(echo "$CHAT_DETAIL" | jq '.data')
CHAT_DETAIL_MEMBER=$(echo "$CHAT_DETAIL_DATA" | jq ".members[] | select(.user_id == $ADMIN_ID)")
DETAIL_UNREAD=$(echo "$CHAT_DETAIL_MEMBER" | jq -r '.unread_count')

if [ "$DETAIL_UNREAD" != "1" ]; then
  echo -e "${RED}✗ GET /api/chats/1 未读数不正确 (期望: 1, 实际: $DETAIL_UNREAD)${NC}"
  echo "完整 chat 数据:"
  echo "$CHAT_DETAIL_DATA" | jq .
  exit 1
fi
echo -e "${GREEN}✓ GET /api/chats/1 未读数正确: $DETAIL_UNREAD${NC}"
echo ""

# 9. admin 调用 markAsRead 标记已读
echo -e "${YELLOW}[9/9]${NC} admin 调用 markAsRead 标记已读..."
MARK_READ_FINAL=$(curl -s -X POST "$SERVER_URL/api/chats/1/read" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"messageId\":$MESSAGE_ID}")

MARK_READ_FINAL_SUCCESS=$(echo "$MARK_READ_FINAL" | jq -r '.success')
if [ "$MARK_READ_FINAL_SUCCESS" != "true" ]; then
  echo -e "${RED}✗ 最终 markAsRead 失败${NC}"
  echo "$MARK_READ_FINAL" | jq .
  exit 1
fi

sleep 1

# 验证未读数已清空
ADMIN_CHATS_FINAL=$(curl -s -X GET "$SERVER_URL/api/chats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_CHAT_1_FINAL=$(echo "$ADMIN_CHATS_FINAL" | jq '.data[] | select(.id == 1)')
ADMIN_MEMBER_FINAL=$(echo "$ADMIN_CHAT_1_FINAL" | jq ".members[] | select(.user_id == $ADMIN_ID)")
FINAL_UNREAD=$(echo "$ADMIN_MEMBER_FINAL" | jq -r '.unread_count')

if [ "$FINAL_UNREAD" != "0" ]; then
  echo -e "${RED}✗ markAsRead 后未读数未清零 (实际: $FINAL_UNREAD)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ markAsRead 后未读数正确清零: $FINAL_UNREAD${NC}"
echo ""

# 全部测试通过
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}✓ 所有测试通过！✓${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo "测试总结："
echo "  ✓ 初始状态清空: $INITIAL_UNREAD"
echo "  ✓ 发送消息后 GET /api/chats: $API_UNREAD"
echo "  ✓ 发送消息后 GET /api/chats/1: $DETAIL_UNREAD"
echo "  ✓ markAsRead 后: $FINAL_UNREAD"
echo "  ✓ 发送的测试消息: $MESSAGE_CONTENT (ID: $MESSAGE_ID)"
echo ""
