const ytdl = require('ytdl-core');
const axios = require('axios');

async function extractVideoMetadata(videoUrl, retryCount = 3) {
  let lastError = null;
  
  for (let i = 0; i < retryCount; i++) {
    try {
      // 确保 videoUrl 是字符串
      if (typeof videoUrl !== 'string') {
        throw new Error('视频 URL 必须是字符串');
      }

      const info = await ytdl.getInfo(videoUrl, {
        requestOptions: {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          },
          timeout: 10000,
        },
      });

      // 确保必要的字段存在
      if (!info?.videoDetails?.title || !info?.videoDetails?.lengthSeconds) {
        throw new Error('无法获取视频信息');
      }

      return {
        videoTitle: info.videoDetails.title,
        videoDuration: parseInt(info.videoDetails.lengthSeconds),
        videoDescription: info.videoDetails.description || ''
      };
    } catch (error) {
      lastError = error;
      console.error(`尝试 ${i + 1}/${retryCount} 失败:`, error.message);
      
      // 如果是网络错误，等待后重试
      if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
        const delay = Math.pow(2, i) * 1000; // 指数退避
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // 如果是其他错误，直接抛出
      throw error;
    }
  }

  // 如果所有重试都失败了
  throw lastError;
}

module.exports = { extractVideoMetadata };