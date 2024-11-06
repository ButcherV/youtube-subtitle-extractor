const axios = require("axios");

async function callLLM(prompt, options = {}) {
  const {
    model = "gpt-4o-mini",  // 默认模型
    temperature = 0.7,        // 默认温度
    systemPrompt = "你是一个专业的英语语法分析助手。请按照要求的格式返回分析结果。",
    retries = 3               // 默认重试次数
  } = options;

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
      return callLLM(prompt, { ...options, retries: retries - 1 });
    }
    
    throw error;
  }
}

module.exports = { callLLM };