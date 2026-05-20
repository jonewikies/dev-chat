#!/usr/bin/env bash
# deploy/init-db.sh
# 用途：在生产服务器上完成后端的依赖安装、编译和数据库初始化。
# 用法：在仓库根目录执行  bash deploy/init-db.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$ROOT_DIR/server-web"
ENV_FILE="$SERVER_DIR/.env"
ENV_EXAMPLE="$SERVER_DIR/.env.example"

# ── 输出工具 ─────────────────────────────────────────────────────────────────
log()  { printf '\033[1;32m[init-db]\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m[init-db] WARN:\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m[init-db] ERROR:\033[0m %s\n' "$1" >&2; exit 1; }
hr()   { printf '%s\n' '─────────────────────────────────────────────────────'; }

# ── 环境检查 ─────────────────────────────────────────────────────────────────
log "检查运行环境"

command -v node >/dev/null 2>&1 || fail "未检测到 node，请先安装 Node.js 18+"
command -v npm  >/dev/null 2>&1 || fail "未检测到 npm，请先安装 npm 9+"

NODE_MAJOR="$(node -e "process.stdout.write(String(process.versions.node.split('.')[0]))")"
[ "$NODE_MAJOR" -ge 18 ] || fail "Node.js 版本过低（当前 $(node -v)），需要 18+"

log "Node.js $(node -v) / npm $(npm -v)"

[ -d "$SERVER_DIR" ] || fail "未找到后端目录: $SERVER_DIR，请确认当前在仓库根目录执行"

# ── 目录准备 ─────────────────────────────────────────────────────────────────
# 说明：以下目录均被 .gitignore 排除，仓库克隆后不存在，必须手动创建。
#   data/         —— SQLite 数据库文件
#   data/backups/ —— 启动时自动备份的存储目录
#   uploads/      —— 用户上传文件（聊天附件、头像等）
#   uploads/prototypes/ —— 原型稿解压目录
#   logs/         —— 运行日志
log "创建运行时目录（data / uploads / logs）"
mkdir -p \
  "$SERVER_DIR/data" \
  "$SERVER_DIR/data/backups" \
  "$SERVER_DIR/uploads/chat-files" \
  "$SERVER_DIR/uploads/prototypes" \
  "$SERVER_DIR/uploads/tmp" \
  "$SERVER_DIR/logs"

# ── 环境变量 ─────────────────────────────────────────────────────────────────
# 说明：.env 被 .gitignore 排除，仓库中只有 .env.example 占位模板。
#   生产环境必须替换 JWT_SECRET 和 ENCRYPTION_KEY，否则存在严重安全风险。
if [ ! -f "$ENV_FILE" ]; then
  [ -f "$ENV_EXAMPLE" ] || fail "未找到 $ENV_EXAMPLE，仓库可能不完整"
  cp "$ENV_EXAMPLE" "$ENV_FILE"
  hr
  warn "已从 .env.example 生成 server-web/.env"
  warn "生产环境在继续之前必须修改以下配置："
  warn "  NODE_ENV=production"
  warn "  JWT_SECRET        — 使用随机长字符串，例如: openssl rand -base64 48"
  warn "  ENCRYPTION_KEY    — 64 位十六进制字符串，例如: openssl rand -hex 32"
  warn "  CORS_ORIGIN       — 前端实际访问域名，例如: https://your-domain.com"
  warn "  PORT              — 后端监听端口，默认 3000"
  hr
  echo ""
  read -r -p "已完成 server-web/.env 配置？输入 yes 继续，其他任意键退出: " CONFIRM
  [ "$CONFIRM" = "yes" ] || { log "已退出。修改 server-web/.env 后重新执行此脚本。"; exit 0; }
fi

# ── 安全校验：阻止在生产中使用 .env.example 的占位密钥 ──────────────────────
get_env_val() {
  grep "^${1}=" "$ENV_FILE" | tail -n1 | cut -d'=' -f2- || true
}

JWT_VAL="$(get_env_val JWT_SECRET)"
ENC_VAL="$(get_env_val ENCRYPTION_KEY)"

# .env.example 中的原始占位值
JWT_PLACEHOLDER="sFKgnS3dneCigNazxzd4xTYvSXx/2Orkm1dxT7n7orc="
ENC_PLACEHOLDER="your-32-byte-hex-encryption-key-change-this"

SECRETS_OK=1
if [ -z "$JWT_VAL" ] || [ "$JWT_VAL" = "$JWT_PLACEHOLDER" ]; then
  warn "JWT_SECRET 仍为占位值，生产环境有被伪造 Token 的风险"
  SECRETS_OK=0
fi
if [ -z "$ENC_VAL" ] || [ "$ENC_VAL" = "$ENC_PLACEHOLDER" ]; then
  warn "ENCRYPTION_KEY 仍为占位值，消息内容将以不安全方式存储"
  SECRETS_OK=0
fi

if [ "$SECRETS_OK" = "0" ]; then
  echo ""
  read -r -p "密钥配置存在风险，是否仍继续？（仅限测试环境）输入 yes 强制继续: " FORCE
  [ "$FORCE" = "yes" ] || { log "已退出。请修正 server-web/.env 后重新执行。"; exit 0; }
fi

# ── 安装依赖 ─────────────────────────────────────────────────────────────────
# 说明：package-lock.json 被 .gitignore 排除，仓库内无锁文件，使用 npm install。
#   若后续希望版本可复现，建议将 package-lock.json 从 .gitignore 中移除。
cd "$SERVER_DIR"
log "安装后端 npm 依赖（npm install）"
npm install

# ── 编译 TypeScript ───────────────────────────────────────────────────────────
# 说明：dist/ 被 .gitignore 排除，仓库中没有编译产物，必须在服务器本地编译。
#   编译同时会把 src/database/schema.sql 复制到 dist/database/。
log "编译 TypeScript → dist/"
npm run build

# ── 初始化数据库 ──────────────────────────────────────────────────────────────
# 说明：data/ 和 *.db 被 .gitignore 排除。
#   package.json 中的初始化入口已经迁到 server-web/scripts/，不再直接把执行入口指向 dist/
#   init-db   — 按 schema.sql 建表，已存在时自动补齐兼容字段，不会覆盖已有数据
#   init-default-data — 当 users 表为空时创建默认管理员，非空时跳过
log "执行 init-db：通过 server-web/scripts 初始化数据库表结构"
npm run init-db

log "执行 init-default-data：通过 server-web/scripts 写入默认管理员账号"
npm run init-default-data

# ── 完成 ─────────────────────────────────────────────────────────────────────
DB_PATH="$(get_env_val DATABASE_PATH)"
[ -z "$DB_PATH" ] && DB_PATH="./data/devchat.db"

hr
log "数据库初始化完成"
log "数据库路径 : $DB_PATH"
log "默认管理员 : admin / 123456"
warn "首次登录后请立即修改默认密码"
hr
log "下一步："
log "  1. 启动后端：cd server-web && pm2 start dist/server.js --name devchat-server"
log "  2. 构建前端：cd app-web && npm install && npm run build"
log "  3. 配置 Nginx 并上线，详见 deploy/README.md"
hr
