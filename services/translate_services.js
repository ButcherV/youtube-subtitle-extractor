const axios = require('axios');

const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.OPENAI_API_KEY; // 注意这里改成了 OPENAI_API_KEY
const MAX_CONCURRENT_REQUESTS = 20; // 最大并发请求数

// 内存缓存
const translationCache = new Map();

async function translateTextWithGPT(text, targetLanguage = 'zh') {
  if (translationCache.has(text)) {
    return translationCache.get(text);
  }

  try {
    const response = await axios.post(API_ENDPOINT, {
      model: "gpt-3.5-turbo",
      messages: [
        {role: "system", content: `You are a translator. Translate the following text to ${targetLanguage}.`},
        {role: "user", content: text}
      ],
      temperature: 0.3,
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const translatedText = response.data.choices[0].message.content.trim();
    translationCache.set(text, translatedText);
    return translatedText;
  } catch (error) {
    console.error('翻译出错:', error.response ? error.response.data : error.message);
    throw new Error(`翻译失败: ${error.response ? JSON.stringify(error.response.data) : error.message}`);
  }
}

async function batchTranslate(subtitles, targetLanguage) {
  const results = [];
  for (let i = 0; i < subtitles.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = subtitles.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const promises = batch.map(subtitle => 
      translateTextWithGPT(subtitle.originText, targetLanguage)
        .then(translatedText => ({
          ...subtitle,
          translatedText
        }))
        .catch(()=> ({
          ...subtitle,
          translatedText: '翻译失败'
        }))
    );
    const batchResults = await Promise.all(promises);
    results.push(...batchResults);
    console.log(`已完成 ${results.length}/${subtitles.length} 条字幕的翻译`);
  }
  return results;
}

async function translateSubtitles(subtitles, targetLanguage = 'zh') {
  console.log(`开始翻译 ${subtitles.length} 条字幕`);
  const translatedSubtitles = await batchTranslate(subtitles, targetLanguage);
  console.log('翻译完成');
  return translatedSubtitles;
}

module.exports = { translateSubtitles };