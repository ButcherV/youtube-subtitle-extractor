const fs = require("fs");
const path = require("path");

// 清理超过指定时间的临时文件
async function cleanupTempFiles(maxLifetime = 3600000) { // 默认1小时
  const tempDir = path.join(__dirname, "..", "temp");

  if (!fs.existsSync(tempDir)) {
    return;
  }

  try {
    const files = fs.readdirSync(tempDir);
    const now = Date.now();

    for (const file of files) {
      try {
        // 从文件名中提取时间戳
        const timestamp = file.split("_")[2];
        if (!timestamp) continue;

        const existTime = now - parseInt(timestamp);
        if (existTime > maxLifetime) {
          const filePath = path.join(tempDir, file);
          await fs.promises.unlink(filePath);
          console.log(`清理文件: ${file}, 已存在 ${Math.floor(existTime/1000)} 秒`);
        }
      } catch (err) {
        console.error(`处理文件 ${file} 时出错:`, err);
      }
    }
  } catch (error) {
    console.error("清理临时文件时出错:", error);
  }
}

module.exports = { cleanupTempFiles };