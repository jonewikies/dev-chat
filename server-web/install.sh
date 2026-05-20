#!/bin/bash

# DevChat 后端安装脚本
# 自动安装 Node.js 18 LTS 并配置项目

set -e

echo "========================================="
echo "DevChat 后端环境配置脚本"
echo "========================================="
echo ""

# 检查当前 Node.js 版本
CURRENT_NODE_VERSION=$(node --version 2>/dev/null || echo "none")
echo "当前 Node.js 版本: $CURRENT_NODE_VERSION"
echo ""

# 检查是否已安装 NVM
if command -v nvm &> /dev/null; then
    echo "✓ NVM 已安装"
else
    echo "× NVM 未安装"
    echo ""
    echo "正在安装 NVM..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    
    # 加载 NVM
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    
    echo "✓ NVM 安装完成"
fi

echo ""
echo "========================================="
echo "安装 Node.js 18 LTS"
echo "========================================="
echo ""

# 加载 NVM（如果之前安装的）
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# 安装 Node.js 18
nvm install 18
nvm use 18
nvm alias default 18

# 验证版本
echo ""
echo "✓ Node.js 版本: $(node --version)"
echo "✓ npm 版本: $(npm --version)"

echo ""
echo "========================================="
echo "安装项目依赖"
echo "========================================="
echo ""

# 清理旧的安装
rm -rf node_modules package-lock.json

# 安装依赖
npm install --legacy-peer-deps

echo ""
echo "✓ 依赖安装完成"

echo ""
echo "========================================="
echo "编译 TypeScript"
echo "========================================="
echo ""

npm run build

echo ""
echo "✓ 编译完成"

echo ""
echo "========================================="
echo "初始化数据库"
echo "========================================="
echo ""

npm run init-db

echo ""
echo "✓ 数据库初始化完成"

echo ""
echo "========================================="
echo "✅ 安装完成！"
echo "========================================="
echo ""
echo "后续步骤："
echo "1. 启动开发服务器: npm run dev"
echo "2. 启动生产服务器: npm start"
echo ""
echo "API 地址: http://localhost:3000/api"
echo "WebSocket: ws://localhost:3000"
echo "健康检查: http://localhost:3000/api/health"
echo ""
