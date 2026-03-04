#!/bin/bash

# AWS SSO 设备授权测试脚本

echo "======================================"
echo "  AWS SSO 设备授权流程测试"
echo "======================================"
echo ""

BASE_URL="http://localhost:3001"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 测试健康检查
echo -e "${YELLOW}1. 测试服务器健康检查...${NC}"
response=$(curl -s "${BASE_URL}/health")
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 服务器运行正常${NC}"
    echo "   响应: $response"
else
    echo -e "${RED}✗ 服务器未运行${NC}"
    echo "   请先启动服务器: cd server && npm start"
    exit 1
fi
echo ""

# 测试设备授权初始化
echo -e "${YELLOW}2. 测试设备授权初始化...${NC}"
response=$(curl -s -X POST "${BASE_URL}/api/auth/device-auth/initiate" \
  -H "Content-Type: application/json")

if [ $? -eq 0 ]; then
    # 检查是否有错误
    error=$(echo $response | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    
    if [ -n "$error" ]; then
        echo -e "${RED}✗ 设备授权初始化失败${NC}"
        echo "   错误: $error"
        message=$(echo $response | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        if [ -n "$message" ]; then
            echo "   详情: $message"
        fi
    else
        echo -e "${GREEN}✓ 设备授权初始化成功${NC}"
        
        # 提取信息
        sessionId=$(echo $response | grep -o '"sessionId":"[^"]*"' | cut -d'"' -f4)
        userCode=$(echo $response | grep -o '"userCode":"[^"]*"' | cut -d'"' -f4)
        verificationUri=$(echo $response | grep -o '"verificationUri":"[^"]*"' | cut -d'"' -f4)
        expiresIn=$(echo $response | grep -o '"expiresIn":[0-9]*' | cut -d':' -f2)
        
        echo ""
        echo -e "${BLUE}   ╔════════════════════════════════════════╗${NC}"
        echo -e "${BLUE}   ║  请完成以下步骤进行授权：              ║${NC}"
        echo -e "${BLUE}   ╚════════════════════════════════════════╝${NC}"
        echo ""
        echo -e "${GREEN}   验证码: ${YELLOW}$userCode${NC}"
        echo -e "${GREEN}   授权地址: ${BLUE}$verificationUri${NC}"
        echo -e "${GREEN}   有效期: ${expiresIn} 秒 ($(($expiresIn / 60)) 分钟)${NC}"
        echo ""
        echo -e "${YELLOW}   1. 在浏览器中打开授权地址${NC}"
        echo -e "${YELLOW}   2. 输入验证码: $userCode${NC}"
        echo -e "${YELLOW}   3. 使用 AWS Builder ID 登录并授权${NC}"
        echo ""
        
        # 保存 sessionId 用于轮询测试
        echo "$sessionId" > /tmp/device_auth_session_id.txt
        
        echo -e "${BLUE}   提示: 可以运行以下命令测试轮询：${NC}"
        echo -e "${BLUE}   curl -X POST $BASE_URL/api/auth/device-auth/poll \\${NC}"
        echo -e "${BLUE}     -H \"Content-Type: application/json\" \\${NC}"
        echo -e "${BLUE}     -d '{\"sessionId\":\"$sessionId\"}'${NC}"
    fi
else
    echo -e "${RED}✗ 请求失败${NC}"
fi
echo ""

# 测试传统登录（验证码）
echo -e "${YELLOW}3. 测试验证码生成...${NC}"
curl -s "${BASE_URL}/api/auth/captcha" -c /tmp/cookies.txt > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ 验证码生成成功${NC}"
else
    echo -e "${RED}✗ 验证码生成失败${NC}"
fi
echo ""

# 清理
rm -f /tmp/cookies.txt

echo "======================================"
echo "  测试完成"
echo "======================================"
echo ""
echo "下一步："
echo "1. 确保服务器正在运行: cd server && npm start"
echo "2. 启动前端: npm run dev"
echo "3. 访问 http://localhost:5173/login"
echo "4. 点击「使用 AWS Builder ID 登录」按钮"
echo "5. 按照弹窗提示完成授权"
echo ""
