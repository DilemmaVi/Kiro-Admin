#!/bin/bash

# OAuth 功能测试脚本

echo "======================================"
echo "  Kiro Admin OAuth 功能测试"
echo "======================================"
echo ""

BASE_URL="http://localhost:3001"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试健康检查
echo -e "${YELLOW}1. 测试服务器健康检查...${NC}"
response=$(curl -s "${BASE_URL}/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 服务器运行正常${NC}"
    echo "   响应: $response"
else
    echo -e "${RED}✗ 服务器未运行${NC}"
    exit 1
fi
echo ""

# 测试 OAuth 初始化
echo -e "${YELLOW}2. 测试 OAuth 初始化...${NC}"
response=$(curl -s "${BASE_URL}/api/auth/oauth/initiate")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ OAuth 初始化成功${NC}"
    
    # 提取授权 URL
    authUrl=$(echo $response | grep -o '"authUrl":"[^"]*"' | cut -d'"' -f4)
    state=$(echo $response | grep -o '"state":"[^"]*"' | cut -d'"' -f4)
    
    echo "   State: $state"
    echo "   授权 URL: ${authUrl:0:80}..."
    echo ""
    echo -e "${YELLOW}   请在浏览器中打开以下 URL 进行授权：${NC}"
    echo "   $authUrl"
else
    echo -e "${RED}✗ OAuth 初始化失败${NC}"
fi
echo ""

# 测试传统登录（验证码）
echo -e "${YELLOW}3. 测试验证码生成...${NC}"
curl -s "${BASE_URL}/api/auth/captcha" -c cookies.txt > /dev/null
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 验证码生成成功${NC}"
else
    echo -e "${RED}✗ 验证码生成失败${NC}"
fi
echo ""

# 清理
rm -f cookies.txt

echo "======================================"
echo "  测试完成"
echo "======================================"
echo ""
echo "下一步："
echo "1. 确保服务器正在运行: cd server && npm start"
echo "2. 启动前端: npm run dev"
echo "3. 访问 http://localhost:5173/login"
echo "4. 点击「使用 AWS OAuth 登录」按钮"
echo ""
