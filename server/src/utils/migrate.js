const { db } = require('../config/database-adapter');

/**
 * 数据库迁移脚本
 * 为 tokens 表添加 user_id 字段
 */
function migrateDatabase() {
  return new Promise((resolve, reject) => {
    console.log('开始数据库迁移...');
    
    db.serialize(() => {
      // 检查 user_id 列是否已存在
      db.all("PRAGMA table_info(tokens)", [], (err, columns) => {
        if (err) {
          console.error('检查表结构失败:', err);
          return reject(err);
        }
        
        const hasUserId = columns.some(col => col.name === 'user_id');
        
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
