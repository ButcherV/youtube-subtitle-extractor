const { callLLM } = require('./llm_service');
const ProcessedVideo = require('../models/ProcessedVideo');
// const MAX_CONCURRENT_REQUESTS = 5; // 最大并发请求数

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
    // 构造正确的 messages 数组
    const messages = [
      {
        role: "system",
        content: `You are a translator. You are translating subtitles for a video titled "${videoTitle}". The video description is: "${videoDescription}". Translate the following text to ${targetLanguage}, keeping the context of the video in mind.`
      },
      {
        role: "user",
        content: text
      }
    ];

    // 直接传入 messages 数组
    const translatedText = await callLLM(messages, userId, isBatch);

    translationCache.set(text, translatedText);
    return translatedText.trim();
  } catch (error) {
    console.error('翻译出错:', error.message);
    throw error;
  }
}

// async function batchTranslate(subtitles, targetLanguage, videoTitle, videoDescription, userId) {
//   const results = [];
//   for (let i = 0; i < subtitles.length; i += MAX_CONCURRENT_REQUESTS) {
//     const batch = subtitles.slice(i, i + MAX_CONCURRENT_REQUESTS);
//     const promises = batch.map(subtitle => 
//       translateTextWithGPT(
//         subtitle.originText, 
//         targetLanguage, 
//         videoTitle, 
//         videoDescription, 
//         userId,
//         true
//       )
//         .then(translatedText => ({
//           ...subtitle,
//           translatedText
//         }))
//         .catch(()=> ({
//           ...subtitle,
//           translatedText: '翻译失败'
//         }))
//     );
//     const batchResults = await Promise.all(promises);
//     results.push(...batchResults);
//     console.log(`已完成 ${results.length}/${subtitles.length} 条字幕的翻译`);
//   }
//   return results;
// }

// async function translateSubtitles(subtitles, targetLanguage = 'zh', videoTitle = '', videoDescription = '', userId) {
//   console.log(`开始翻译 ${subtitles.length} 条字幕`);
//   const translatedSubtitles = await batchTranslate(subtitles, targetLanguage, videoTitle, videoDescription, userId);
//   console.log('翻译完成');
//   return translatedSubtitles;
// }

// 用于翻译单个批次
async function translateBatch(subtitles, targetLanguage, videoTitle, videoDescription, userId) {
  const promises = subtitles.map(subtitle => 
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
      .catch(() => ({
        ...subtitle,
        translatedText: '翻译失败'
      }))
  );
  
  return Promise.all(promises);
}

// 用于翻译剩余文案
async function translateRemaining(processedVideoId, remainingSubtitles, targetLanguage, metadata, userId) {
  try {
    const batchSize = 5;  // 保持每批 5 条
    
    for (let i = 0; i < remainingSubtitles.length; i += batchSize) {
      const batch = remainingSubtitles.slice(i, i + batchSize);
      const translatedBatch = await translateBatch(
        batch,
        targetLanguage,
        metadata.videoTitle,
        metadata.videoDescription,
        userId
      );

      // 获取当前数据库中的数据
      const doc = await ProcessedVideo.findById(processedVideoId);
      const currentSubtitles = doc.data.subtitles;
      
      // 更新翻译结果（注意 index 要加 5，因为前 5 条已经翻译过）
      translatedBatch.forEach((item, index) => {
        currentSubtitles[i + 5 + index] = item;
      });

      // 保存更新后的结果
      await ProcessedVideo.findByIdAndUpdate(processedVideoId, {
        $set: {
          'data.subtitles': currentSubtitles
        }
      });
    }

    // 全部翻译完成后，更新状态为已完成
    await ProcessedVideo.findByIdAndUpdate(processedVideoId, {
      $set: { status: 'completed' }
    });
  } catch (error) {
    console.error('后台翻译出错:', error);
    // 出错时更新状态
    await ProcessedVideo.findByIdAndUpdate(processedVideoId, {
      $set: { status: 'error' }
    });
  }
}

module.exports = { 
  translateBatch,
  translateRemaining
};