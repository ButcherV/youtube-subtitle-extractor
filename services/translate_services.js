const { callLLM } = require('./llm_service');
const MAX_CONCURRENT_REQUESTS = 20; // 最大并发请求数

// 内存缓存
const translationCache = new Map();

async function translateTextWithGPT(
  text, 
  targetLanguage = 'zh', 
  videoTitle, 
  videoDescription,
  userId,
  isBatch = false
) {
  if (translationCache.has(text)) {
    return translationCache.get(text);
  }

  try {
    const systemPrompt = `You are a translator. You are translating subtitles for a video titled "${videoTitle}". The video description is: "${videoDescription}". Translate the following text to ${targetLanguage}, keeping the context of the video in mind.`;

    const translatedText = await callLLM(text, {
      model: "gpt-4o-mini",
      temperature: 0.7,
      systemPrompt,
      isBatch
    }, userId);

    translationCache.set(text, translatedText);
    return translatedText.trim();
  } catch (error) {
    console.error('翻译出错:', error.message);
    throw error;
  }
}

async function batchTranslate(subtitles, targetLanguage, videoTitle, videoDescription, userId) {
  const results = [];
  for (let i = 0; i < subtitles.length; i += MAX_CONCURRENT_REQUESTS) {
    const batch = subtitles.slice(i, i + MAX_CONCURRENT_REQUESTS);
    const promises = batch.map(subtitle => 
      translateTextWithGPT(
        subtitle.originText, 
        targetLanguage, 
        videoTitle, 
        videoDescription, 
        userId,
        true
      )
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

async function translateSubtitles(subtitles, targetLanguage = 'zh', videoTitle = '', videoDescription = '', userId) {
  console.log(`开始翻译 ${subtitles.length} 条字幕`);
  const translatedSubtitles = await batchTranslate(subtitles, targetLanguage, videoTitle, videoDescription, userId);
  console.log('翻译完成');
  return translatedSubtitles;
}

module.exports = { translateSubtitles };