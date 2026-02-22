#!/bin/bash

# 获取脚本所在目录
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "🚀 启动 Kiro Admin 系统..."
echo "📁 工作目录: $SCRIPT_DIR"

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装前端依赖..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "📦 安装后端依赖..."
    cd server && npm install && cd ..
fi

# 启动后端服务器
echo "🔧 启动后端服务器..."
(cd server && npm start) &
SERVER_PID=$!

# 等待后端启动
sleep 3

# 启动前端开发服务器
echo "🎨 启动前端开发服务器..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Kiro Admin 已启动！"
echo "📊 前端地址: http://localhost:5173"
echo "🔌 后端地址: http://localhost:3001"
echo "👤 默认账号: admin / admin123"
echo ""
echo "按 Ctrl+C 停止服务..."

# 捕获退出信号
trap "kill $SERVER_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# 等待进程
wait
