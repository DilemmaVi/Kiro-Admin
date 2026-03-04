const { db } = require('../config/database-adapter');

/**
 * 数据库迁移脚本
 * 为 tokens 表添加 user_id 字段
 */
function migrateDatabase() {
  return new Promise((resolve, reject) => {
    console.log('开始数据库迁移...');
    
    const dbType = process.env.DB_TYPE || 'sqlite';
    
    db.serialize(() => {
      // 根据数据库类型使用不同的查询语句
      let checkColumnSql;
      
      if (dbType === 'postgres') {
        // PostgreSQL: 查询 information_schema
        checkColumnSql = `
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'tokens' AND column_name = 'user_id'
        `;
      } else {
        // SQLite: 使用 PRAGMA
        checkColumnSql = "PRAGMA table_info(tokens)";
      }
      
      // 检查 user_id 列是否已存在
      db.all(checkColumnSql, [], (err, result) => {
        if (err) {
          console.error('检查表结构失败:', err);
          return reject(err);
        }
        
        let hasUserId;
        if (dbType === 'postgres') {
          // PostgreSQL: 检查是否有返回结果
          hasUserId = result && result.length > 0;
        } else {
          // SQLite: 检查列名
          hasUserId = result.some(col => col.name === 'user_id');
        }
        
        if (hasUserId) {
          console.log('✓ user_id 字段已存在，跳过迁移');
          return resolve();
        }
        
        console.log('添加 user_id 字段...');
        
        // 添加 user_id 列
        db.run(
          'ALTER TABLE tokens ADD COLUMN user_id INTEGER',
          (err) => {
            if (err) {
              // 如果错误是因为列已存在，忽略错误
              if (err.message && err.message.includes('already exists')) {
                console.log('✓ user_id 字段已存在');
                return resolve();
              }
              console.error('添加 user_id 字段失败:', err);
              return reject(err);
            }
            
            console.log('✓ 成功添加 user_id 字段');
            resolve();
          }
        );
      });
    });
  });
}

// 如果直接运行此脚本
if (require.main === module) {
  migrateDatabase()
    .then(() => {
      console.log('数据库迁移完成');
      process.exit(0);
    })
    .catch((err) => {
      console.error('数据库迁移失败:', err);
      process.exit(1);
    });
}

module.exports = { migrateDatabase };
