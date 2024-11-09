const axios = require('axios');
const RateLimiter = require('./rate_limiter');
const https = require('https');

// 创建自定义的 axios 实例
const api = axios.create({
  timeout: 60000, // 60 秒超时
  httpsAgent: new https.Agent({ 
    keepAlive: true,
    timeout: 60000,
    rejectUnauthorized: false // 注意：仅在开发环境使用
  }),
  proxy: false // 禁用任何可能的代理设置
});

async function callLLM(messages, userId, isBatch = false) {
  const maxRetries = 3;
  let retryCount = 0;
  let delay = 1000;

  while (retryCount < maxRetries) {
    try {
      const apiCall = async () => {
        console.log('正在调用 OpenAI API...');
        const response = await api.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: 'gpt-4o-mini',
            messages: messages,
            temperature: 0.3,
            max_tokens: 1000,
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            }
          }
        );
        console.log('OpenAI API 响应成功');
        return response.data.choices[0].message.content;
      };

      const limiterType = isBatch ? 'gpt_batch' : 'gpt';
      return await RateLimiter.openai[limiterType](apiCall, userId);

    } catch (error) {
      retryCount++;
      console.error(`LLM API 调用错误: ${error.code || error.message}`);
      
      if (retryCount === maxRetries) {
        console.error('达到最大重试次数，放弃重试');
        throw error;
      }

      // 对于网络错误，增加等待时间
      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' || error.code === 'ECONNRESET') {
        delay = Math.min(delay * 2, 10000); // 最多等待 10 秒
        console.log(`网络错误，等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      // API 限流错误处理
      if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'] || 5;
        console.log(`API 限流，等待 ${retryAfter} 秒后重试`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      throw error;
    }
  }
}

module.exports = {
  callLLM
};