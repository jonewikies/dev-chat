#!/bin/bash

# 使用 Homebrew 快速安装 Node.js 18
echo "正在安装 Node.js 18..."

# 检查是否已有 node@18
if brew list node@18 &>/dev/null; then
    echo "Node.js 18 已安装，正在链接..."
else
    echo "正在安装 Node.js 18..."
    brew install node@18
fi

# 取消当前 node 链接
brew unlink node 2>/dev/null || true

# 链接 node@18
brew link node@18 --force --overwrite

# 验证
echo ""
echo "Node.js 版本: $(node --version)"
echo "npm 版本: $(npm --version)"
echo ""
echo "✅ Node.js 18 安装完成！"
