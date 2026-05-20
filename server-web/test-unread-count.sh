#!/bin/bash

# 测试未读消息计数功能
# 场景：wikies 发送消息给 admin，验证 admin 的未读消息数正确显示

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
echo -e "${YELLOW}[1/8]${NC} 登录 admin 用户..."
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
echo -e "${GREEN}✓ admin 登录成功 (ID: $ADMIN_ID, Token: ${ADMIN_TOKEN:0:20}...)${NC}"
echo ""

# 2. 登录 wikies 用户
echo -e "${YELLOW}[2/8]${NC} 登录 wikies 用户..."
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
echo -e "${GREEN}✓ wikies 登录成功 (ID: $WIKIES_ID, Token: ${WIKIES_TOKEN:0:20}...)${NC}"
echo ""

# 3. 重置 chat_id=1 的未读消息数（通过 API）
echo -e "${YELLOW}[3/8]${NC} 重置未读消息计数（调用 markAsRead API）..."
MARK_READ_RESPONSE=$(curl -s -X POST "$SERVER_URL/api/chats/1/read" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"messageId":0}')

MARK_READ_SUCCESS=$(echo "$MARK_READ_RESPONSE" | jq -r '.success')
if [ "$MARK_READ_SUCCESS" != "true" ]; then
  echo -e "${RED}✗ 调用 markAsRead API 失败${NC}"
  echo "$MARK_READ_RESPONSE" | jq .
  exit 1
fi

# 验证数据库确实被重置
sleep 1  # 等待数据库更新
DB_CHECK=$(sqlite3 data/devchat.db "SELECT unread_count FROM chat_members WHERE chat_id = 1 AND user_id = $ADMIN_ID;")
if [ "$DB_CHECK" != "0" ]; then
  echo -e "${RED}✗ 数据库重置失败 (当前值: $DB_CHECK)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 未读消息计数已重置 (数据库验证: $DB_CHECK)${NC}"
echo ""

# 4. 验证初始状态 - admin 的未读数应该为 0
echo -e "${YELLOW}[4/8]${NC} 验证初始状态..."
ADMIN_CHATS=$(curl -s -X GET "$SERVER_URL/api/chats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_CHAT_1=$(echo "$ADMIN_CHATS" | jq '.data[] | select(.id == 1)')
if [ -z "$ADMIN_CHAT_1" ]; then
  echo -e "${RED}✗ 未找到 chat_id=1${NC}"
  exit 1
fi

# 检查是否有 members 字段
HAS_MEMBERS=$(echo "$ADMIN_CHAT_1" | jq 'has("members")')
if [ "$HAS_MEMBERS" != "true" ]; then
  echo -e "${RED}✗ API 响应缺少 members 字段${NC}"
  echo "$ADMIN_CHAT_1" | jq .
  exit 1
fi

ADMIN_MEMBER=$(echo "$ADMIN_CHAT_1" | jq ".members[] | select(.user_id == $ADMIN_ID)")
INITIAL_UNREAD=$(echo "$ADMIN_MEMBER" | jq -r '.unread_count')

if [ "$INITIAL_UNREAD" != "0" ]; then
  echo -e "${RED}✗ 初始未读数不为 0 (实际: $INITIAL_UNREAD)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 初始未读数正确: $INITIAL_UNREAD${NC}"
echo ""

# 5. wikies 发送消息到 chat_id=1
echo -e "${YELLOW}[5/8]${NC} wikies 发送消息..."
MESSAGE_CONTENT="测试消息-$(date +%s)"
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
echo -e "${GREEN}✓ 消息发送成功: $MESSAGE_CONTENT${NC}"
echo ""

# 6. 验证数据库中的未读数
echo -e "${YELLOW}[6/8]${NC} 验证数据库中的未读数..."
sleep 1  # 等待数据库更新
DB_UNREAD=$(sqlite3 data/devchat.db "SELECT unread_count FROM chat_members WHERE chat_id = 1 AND user_id = $ADMIN_ID;")

if [ "$DB_UNREAD" != "1" ]; then
  echo -e "${RED}✗ 数据库未读数不正确 (期望: 1, 实际: $DB_UNREAD)${NC}"
  exit 1
fi
echo -e "${GREEN}✓ 数据库未读数正确: $DB_UNREAD${NC}"
echo ""

# 7. 验证 API 返回的未读数 - GET /api/chats
echo -e "${YELLOW}[7/8]${NC} 验证 GET /api/chats 返回的未读数..."
ADMIN_CHATS_AFTER=$(curl -s -X GET "$SERVER_URL/api/chats" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_CHAT_1_AFTER=$(echo "$ADMIN_CHATS_AFTER" | jq '.data[] | select(.id == 1)')
ADMIN_MEMBER_AFTER=$(echo "$ADMIN_CHAT_1_AFTER" | jq ".members[] | select(.user_id == $ADMIN_ID)")
API_UNREAD=$(echo "$ADMIN_MEMBER_AFTER" | jq -r '.unread_count')

if [ "$API_UNREAD" != "1" ]; then
  echo -e "${RED}✗ GET /api/chats 未读数不正确 (期望: 1, 实际: $API_UNREAD)${NC}"
  echo "$ADMIN_CHAT_1_AFTER" | jq .
  exit 1
fi
echo -e "${GREEN}✓ GET /api/chats 未读数正确: $API_UNREAD${NC}"
echo ""

# 8. 验证 API 返回的未读数 - GET /api/chats/1
echo -e "${YELLOW}[8/8]${NC} 验证 GET /api/chats/1 返回的未读数..."
CHAT_DETAIL=$(curl -s -X GET "$SERVER_URL/api/chats/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

CHAT_DETAIL_DATA=$(echo "$CHAT_DETAIL" | jq '.data')
CHAT_DETAIL_MEMBER=$(echo "$CHAT_DETAIL_DATA" | jq ".members[] | select(.user_id == $ADMIN_ID)")
DETAIL_UNREAD=$(echo "$CHAT_DETAIL_MEMBER" | jq -r '.unread_count')

if [ "$DETAIL_UNREAD" != "1" ]; then
  echo -e "${RED}✗ GET /api/chats/1 未读数不正确 (期望: 1, 实际: $DETAIL_UNREAD)${NC}"
  echo "$CHAT_DETAIL_DATA" | jq .
  exit 1
fi
echo -e "${GREEN}✓ GET /api/chats/1 未读数正确: $DETAIL_UNREAD${NC}"
echo ""

# 全部测试通过
echo -e "${BOLD}========================================${NC}"
echo -e "${GREEN}${BOLD}✓ 所有测试通过！✓${NC}"
echo -e "${BOLD}========================================${NC}"
echo ""
echo "测试总结："
echo "  ✓ 数据库未读数: $DB_UNREAD"
echo "  ✓ GET /api/chats 未读数: $API_UNREAD"
echo "  ✓ GET /api/chats/1 未读数: $DETAIL_UNREAD"
echo ""
