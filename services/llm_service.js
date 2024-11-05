const axios = require("axios");

async function callLLM(prompt) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "你是一个专业的英语语法分析助手。请按照要求的格式返回分析结果。",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
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
      // 等待 1 秒后重试
      await new Promise(resolve => setTimeout(resolve, 1000));
      return callLLM(messages, retries - 1);
    }
    
    throw error;
  }
}

module.exports = { callLLM };
