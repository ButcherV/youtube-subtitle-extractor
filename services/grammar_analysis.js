const axios = require("axios");

const { OPENAI_API_ENDPOINT } = require("../constants");
const API_KEY = process.env.OPENAI_API_KEY;

async function analyzeGrammar(text) {
  try {
    const response = await axios.post(
      OPENAI_API_ENDPOINT,
      {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an English language expert. Analyze the following text and provide:

1. A list of advanced vocabulary words (ONLY suitable for Chinese mainland postgraduate level and above). Strictly exclude common words like "order", "show", or any words that a typical undergraduate student would know. Include their original form if different, phonetic pronunciation, part of speech, and translation to Chinese.

2. A comprehensive list of unique word combinations, including but not limited to:
   - Phrases
   - Idioms
   - Collocations
   - Fixed expressions
   - Proper nouns
   - Phrasal verbs
   - Any other notable word combinations
   Provide their Chinese translations. If they have any variations in the text, provide the original or base form. Do not repeat combinations even if they appear multiple times in the text.

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

Note: 
1. For words or phrases that are already in their original form, the "originalForm" field should be the same as the "word" or "phrase" field.
2. ONLY include truly advanced vocabulary words, suitable for postgraduate level and above. If no such words exist in the text, return an empty array for "words".
3. Ensure each phrase or word combination is unique in the list. If a phrase appears multiple times with different meanings, include it only once with all relevant translations.
4. Do not include common words or phrases in either list. Focus only on advanced or specialized language.
5. If no advanced words or phrases are found, return empty arrays for both "words" and "phrases".`
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