const axios = require("axios");
const RateLimiter = require("./rate_limiter");  // 已有的限流器引入

async function callLLM(prompt, options = {}, userId) {  // [修改] 添加 userId 参数
  const {
    model = "gpt-4o-mini",
    temperature = 0.7,
    systemPrompt = "你是一个专业的英语语法分析助手。请按照要求的格式返回分析结果。",
    retries = 3,
    isBatch = false
  } = options;

  const makeRequest = async () => {
    try {
      const response = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("LLM API 调用错误:", error.code || error.message);
      
      if (retries > 0 && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT')) {
        console.log(`重试剩余次数: ${retries - 1}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        // 递归调用改为重试当前请求
        return makeRequest();
      }
      
      throw error;
    }
  };

  return isBatch 
    ? RateLimiter.openai.gpt_batch(makeRequest, userId)
    : RateLimiter.openai.gpt(makeRequest, userId);
}

module.exports = { callLLM };