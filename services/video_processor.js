// 数据格式：
// {
//   "meta": {
//     "videoTitle": "",
//     "videoDescription": "",
//     "videoDuration": 420
//   },
//   "subtitles": [
//     {
//       "id": "subtitle_1",
//       "start": 0.658,
//       "end": 3.158,
//       "originText": "(light music)",
//       "translatedText": "（轻快音乐）",
//     }
//   ]
// }

// services/video_processor.js
const ytdl = require("ytdl-core");
// const { getSubtitles } = require("./youtube_subtitle_extractor");
const { generateSubtitlesWithWhisper } = require("./whisper_subtitle_generator");
const { extractVideoMetadata } = require("./youtube_metadata_extractor");
const { translateSubtitles } = require("./translate_services");
const ProcessedVideo = require('../models/ProcessedVideo');

async function processVideo(videoUrl, targetLanguage = "zh", userId) {
  try {
    const videoId = ytdl.getVideoID(videoUrl);
    
    // 01. 检查数据库中是否已存在处理过的视频信息
    const existingProcessedVideo = await ProcessedVideo.findOne({ userId, videoId });
    if (existingProcessedVideo) {
      console.log("从数据库返回已处理的视频信息");
      return existingProcessedVideo.data;
    }

    // // 02. 如果数据库中不存在，则尝试提取自带字幕
    // console.log("处理新视频");
    // const info = await ytdl.getInfo(videoUrl);
    // let { parsedSubtitles } = await getSubtitles(info);

    // // 03. 如果自带字幕不存在，则使用 Whisper 生成字幕
    // if (!parsedSubtitles || parsedSubtitles.length === 0) {
    //   console.log("未找到自带字幕，使用 Whisper 生成...");
    //   parsedSubtitles = await generateSubtitlesWithWhisper(videoUrl);
    // }

    // 02. 如果数据库中不存在，则使用 Whisper 生成字幕
    // 自带字幕的水平参差不齐。暂时都有 whisper 来处理
    console.log("处理新视频");
    const info = await ytdl.getInfo(videoUrl);

    // 03. 使用 Whisper 生成字幕
    console.log("使用 Whisper 生成字幕...");
    const parsedSubtitles = await generateSubtitlesWithWhisper(videoUrl);

    // 04. 提取视频元数据
    const metadata = await extractVideoMetadata(info);

    // 05. 翻译字幕
    const translatedSubtitles = await translateSubtitles(
      parsedSubtitles,
      targetLanguage,
      metadata.videoTitle,
      metadata.videoDescription
    );

    // 06. 汇总、返回结果
    const result = {
      meta: {
        videoTitle: metadata.videoTitle,
        videoDescription: metadata.videoDescription,
        videoDuration: metadata.videoDuration,
      },
      subtitles: translatedSubtitles,
    };

    // 将处理结果存储到数据库
    await ProcessedVideo.create({ userId, videoId, data: result });

    return result;
  } catch (error) {
    console.error("处理视频时出错:", error.message);
    throw new Error("处理视频时出错: " + error.message);
  }
}

module.exports = { processVideo };
