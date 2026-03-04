#!/bin/bash

# Token 插入验证脚本

echo "======================================"
echo "  Token 插入验证"
echo "======================================"
echo ""

DB_PATH="server/data/kiro.db"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查数据库文件是否存在
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}✗ 数据库文件不存在: $DB_PATH${NC}"
    echo "  请先启动服务器以初始化数据库"
    exit 1
fi

echo -e "${GREEN}✓ 数据库文件存在${NC}"
echo ""

# 查询所有 token
echo -e "${YELLOW}1. 查询所有 Token 记录：${NC}"
echo ""
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 
  id,
  auth_type,
  SUBSTR(refresh_token, 1, 30) || '...' as token_preview,
  description,
  disabled,
  user_id,
  created_at
FROM tokens
ORDER BY created_at DESC;
EOF
echo ""

# 查询自动添加的 token
echo -e "${YELLOW}2. 查询自动添加的 Token（设备授权）：${NC}"
echo ""
count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tokens WHERE description LIKE '%设备授权%';")
if [ "$count" -gt 0 ]; then
    echo -e "${GREEN}✓ 找到 $count 个自动添加的 Token${NC}"
    echo ""
    sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 
  t.id,
  t.auth_type,
  t.description,
  t.disabled,
  t.created_at,
  u.username as user
FROM tokens t
LEFT JOIN users u ON t.user_id = u.id
WHERE t.description LIKE '%设备授权%'
ORDER BY t.created_at DESC;
EOF
else
    echo -e "${YELLOW}⚠ 未找到自动添加的 Token${NC}"
    echo "  这可能意味着："
    echo "  1. 还没有通过 AWS SSO 登录"
    echo "  2. Token 插入失败"
    echo "  3. Token 描述不匹配"
fi
echo ""

# 查询用户和 token 关联
echo -e "${YELLOW}3. 用户和 Token 关联统计：${NC}"
echo ""
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 
  u.id as user_id,
  u.username,
  u.role,
  COUNT(t.id) as token_count,
  MAX(t.created_at) as last_token_created
FROM users u
LEFT JOIN tokens t ON u.id = t.user_id
GROUP BY u.id
ORDER BY token_count DESC;
EOF
echo ""

# 查询最近的 token
echo -e "${YELLOW}4. 最近添加的 5 个 Token：${NC}"
echo ""
sqlite3 "$DB_PATH" <<EOF
.mode column
.headers on
SELECT 
  id,
  auth_type,
  description,
  disabled,
  user_id,
  datetime(created_at, 'localtime') as created_at_local
FROM tokens
ORDER BY created_at DESC
LIMIT 5;
EOF
echo ""

# 统计信息
echo -e "${YELLOW}5. 统计信息：${NC}"
echo ""
total_tokens=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tokens;")
active_tokens=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tokens WHERE disabled = 0;")
disabled_tokens=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tokens WHERE disabled = 1;")
auto_tokens=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tokens WHERE description LIKE '%设备授权%' OR description LIKE '%OAuth%';")

echo -e "  总 Token 数: ${BLUE}$total_tokens${NC}"
echo -e "  启用的 Token: ${GREEN}$active_tokens${NC}"
echo -e "  禁用的 Token: ${RED}$disabled_tokens${NC}"
echo -e "  自动添加的 Token: ${YELLOW}$auto_tokens${NC}"
echo ""

# 检查 user_id 字段
echo -e "${YELLOW}6. 检查 user_id 字段：${NC}"
echo ""
has_user_id=$(sqlite3 "$DB_PATH" "PRAGMA table_info(tokens);" | grep -c "user_id")
if [ "$has_user_id" -gt 0 ]; then
    echo -e "${GREEN}✓ tokens 表包含 user_id 字段${NC}"
    
    # 检查有多少 token 关联了用户
    linked_tokens=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM tokens WHERE user_id IS NOT NULL;")
    echo -e "  关联用户的 Token: ${BLUE}$linked_tokens${NC}"
else
    echo -e "${RED}✗ tokens 表缺少 user_id 字段${NC}"
    echo "  请运行数据库迁移: node server/src/utils/migrate.js"
fi
echo ""

echo "======================================"
echo "  验证完成"
echo "======================================"
echo ""

# 提供建议
if [ "$auto_tokens" -eq 0 ]; then
    echo -e "${YELLOW}建议：${NC}"
    echo "1. 启动服务器: cd server && npm start"
    echo "2. 启动前端: npm run dev"
    echo "3. 访问 http://localhost:5173/login"
    echo "4. 点击「使用 AWS Builder ID 登录」"
    echo "5. 完成授权后再次运行此脚本"
    echo ""
fi
