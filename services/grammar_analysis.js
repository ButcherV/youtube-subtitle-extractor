const axios = require("axios");

const API_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const API_KEY = process.env.OPENAI_API_KEY;

async function analyzeGrammar(text) {
  try {
    const response = await axios.post(
      API_ENDPOINT,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an English language expert. Analyze the following text and provide:

1. A list of advanced vocabulary words (suitable for Chinese mainland undergraduate level and above), including their original form if different, phonetic pronunciation, part of speech, and translation to Chinese.

2. A comprehensive list of all types of word combinations, including but not limited to:
   - Phrases
   - Idioms
   - Collocations
   - Fixed expressions
   - Proper nouns
   - Phrasal verbs
   - Any other notable word combinations
   Provide their Chinese translations. If they have any variations in the text, provide the original or base form.

Provide your analysis in a structured JSON format as follows:


{
  "words": [
    {
      "word": "",
      "originalForm": "",
      "phonetic": "",
      "partOfSpeech": "",
      "translation": ""
    }
  ],
  "phrases": [
    {
      "phrase": "",
      "originalForm": "",
      "translation": ""
    }
  ]
}

Note: For words or phrases that are already in their original form, the "originalForm" field should be the same as the "word" or "phrase" field.`
          },
          { role: "user", content: text },
        ],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    const content = response.data.choices[0].message.content.trim();
    return JSON.parse(content);  // 解析JSON字符串为JavaScript对象
  } catch (error) {
    console.error(
      "语法分析出错:",
      error.response ? error.response.data : error.message
    );
    throw new Error(
      `语法分析失败: ${
        error.response ? JSON.stringify(error.response.data) : error.message
      }`
    );
  }
}

module.exports = { analyzeGrammar };