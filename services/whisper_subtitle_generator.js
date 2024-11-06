// const youtubedl = require("youtube-dl-exec");
const axios = require("axios");
const FormData = require("form-data");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require('fs');
const path = require('path');
const youtubedl = require('youtube-dl-exec');
const RateLimiter = require("./rate_limiter");

const API_KEY = process.env.OPENAI_API_KEY;
// const { OPENAI_API_ENDPOINT } = require("../constants");
const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";

async function generateSubtitlesWithWhisper(videoUrl, userId, requestId) {
  let audioFilePath = null;  // 用变量保存文件路径
  let tempFiles = []; // 用数组记录所有临时文件
  
  try {
    console.log(`[${userId}][${requestId}] 开始生成字幕，视频URL:`, videoUrl);

    // 步骤 1: 从 YouTube 视频中提取音频流
    console.log(`[${userId}][${requestId}] 步骤 1: 开始从 YouTube 视频中提取音频流`);
    audioFilePath = await extractAudioFromYouTube(videoUrl, userId, requestId);
    tempFiles.push(audioFilePath);  // 记录文件路径
    console.log(`[${userId}][${requestId}] 步骤 1: 音频流提取完成`);

    // 步骤 2: 使用 Whisper API 将音频转换为文字
    console.log(`[${userId}][${requestId}] 步骤 2: 开始使用 Whisper API 转换音频`);
    const whisperResponse = await transcribeAudio(audioFilePath, userId, requestId);
    console.log(`[${userId}][${requestId}] 步骤 2: Whisper API 转换完成`);

    // 步骤 3: 检查语言
    if (whisperResponse.language.toLowerCase() !== 'english') {
      throw new Error(`VIDEO_LANGUAGE_ERROR:检测到视频语言为 ${whisperResponse.language}，请上传英文视频`);
    }

    // 步骤 4: 将 Whisper 输出转换为所需的格式
    console.log(`[${userId}][${requestId}] 步骤 3: 开始格式化字幕`);
    const formattedSubtitles = formatSubtitles(whisperResponse);
    console.log(`[${userId}][${requestId}] 步骤 3: 字幕格式化完成`);

    return formattedSubtitles;
  } catch (error) {
    console.error(`[${userId}][${requestId}] 生成字幕时出错:`, error);
    throw error;
  } finally {
    // 清理所有临时文件
    for (const filePath of tempFiles) {
      try {
        if (filePath && fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
          console.log(`[${userId}][${requestId}] 临时文件已删除:`, filePath);
        }
      } catch (err) {
        console.error(`[${userId}][${requestId}] 删除临时文件失败:`, err);
      }
    }
  }
}

async function extractAudioFromYouTube(videoUrl, userId, requestId) {
  console.log(`[${userId}][${requestId}] 开始从 YouTube 提取音频`);
  let downloadedFile = null;

  // 创建临时文件路径
  const projectRoot = path.resolve(__dirname, '..');
  const tempDir = path.join(projectRoot, 'temp');

  // 确保临时目录存在
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }

  // 添加时间戳的文件命名方式
  const timestamp = Date.now();
  const outputPath = path.join(tempDir, `${userId}_${requestId}_${timestamp}_%(ext)s`);

  try {
    const output = await youtubedl(videoUrl, {
      extractAudio: true,
      audioFormat: 'mp3',
      output: outputPath,
      noCheckCertificates: true,
      noWarnings: true,
      preferFreeFormats: true,
      addHeader: [
        'referer:youtube.com',
        'user-agent:Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      ]
    });
  
    console.log(`[${userId}][${requestId}] youtube-dl 输出:`, output);
  
    // 查找创建的文件
    const files = fs.readdirSync(tempDir);
    console.log(`[${userId}][${requestId}] 临时目录内容:`, files);

    // 修改文件查找逻辑
    downloadedFile = files.find(file => 
      file.startsWith(`${userId}_${requestId}_${timestamp}`)
    );
  
    if (!downloadedFile) {
      throw new Error('下载文件未找到');
    }

    const fullPath = path.join(tempDir, downloadedFile);
    console.log(`[${userId}][${requestId}] 文件已下载:`, fullPath);
    console.log(`[${userId}][${requestId}] 文件大小:`, fs.statSync(fullPath).size, "字节");

    // 如果文件是 .webm 格式，转换为 mp3
    if (path.extname(fullPath) === '.webm') {
      const mp3Path = fullPath.replace('.webm', '.mp3');
      await new Promise((resolve, reject) => {
        ffmpeg(fullPath)
          .toFormat('mp3')
          .on('error', (err) => reject(err))
          .on('end', () => {
            // 转换完成后删除 webm 文件
            try {
              fs.unlinkSync(fullPath);
              console.log(`[${userId}][${requestId}] 原始 webm 文件已删除`);
            } catch (err) {
              console.error(`[${userId}][${requestId}] 删除 webm 文件失败:`, err);
            }
            resolve();
          })
          .save(mp3Path);
      });
      console.log(`[${userId}][${requestId}] 文件已转换为 MP3 格式:`, mp3Path);
      return mp3Path;
    }

    return fullPath;
  } catch (error) {
    console.error(`[${userId}][${requestId}] 音频提取出错:`, error);
    // 如果有下载的文件，清理它
    if (downloadedFile) {
      try {
        const filePath = path.join(tempDir, downloadedFile);
        fs.unlinkSync(filePath);
        console.log(`[${userId}][${requestId}] 错误发生，已清理下载的文件:`, filePath);
      } catch (err) {
        console.error(`[${userId}][${requestId}] 清理文件失败:`, err);
      }
    }
    throw error;
  }
}

async function transcribeAudio(audioFilePath, userId, requestId) {
  console.log(`[${userId}][${requestId}] 开始准备 Whisper API 请求`);
  
  // 检查文件是否存在
  if (!fs.existsSync(audioFilePath)) {
    console.error(`[${userId}][${requestId}] 音频文件不存在:`, audioFilePath);
    throw new Error('音频文件不存在');
  }

  // 将 Whisper API 调用封装为独立函数
  const makeWhisperRequest = async () => {
    const formData = new FormData();
    console.log(`[${userId}][${requestId}] 正在读取音频文件:`, audioFilePath);
    const audioFile = fs.createReadStream(audioFilePath);
    formData.append("file", audioFile, { filename: "audio.mp3", contentType: "audio/mpeg" });
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "segment");

    try {
      console.log(`[${userId}][${requestId}] 发送请求到 Whisper API`);
      
      const response = await axios.post(WHISPER_API_URL, formData, {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${API_KEY}`,
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (progressEvent) => {
          console.log(`[${userId}][${requestId}] 上传进度: ${Math.round((progressEvent.loaded * 100) / progressEvent.total)}%`);
        }
      });

      console.log(`[${userId}][${requestId}] Whisper API 响应状态:`, response.status);
      return response.data;
    } catch (error) {
      console.error(`[${userId}][${requestId}] Whisper API 调用失败:`, error.message);
      if (error.response) {
        console.error(`[${userId}][${requestId}] 响应状态:`, error.response.status);
        console.error(`[${userId}][${requestId}] 响应数据:`, error.response.data);
      } else if (error.request) {
        console.error(`[${userId}][${requestId}] 请求已发送但没有收到响应`);
        console.error(`[${userId}][${requestId}] 请求详情:`, error.request);
      } else {
        console.error(`[${userId}][${requestId}] 请求配置出错:`, error.config);
      }
      throw error;
    }
  };

  // 使用 Whisper 限流器包装请求
  return RateLimiter.openai.whisper(makeWhisperRequest, userId);
}

function formatSubtitles(whisperOutput) {
  console.log("whisperOutput", whisperOutput);
  console.log("开始格式化 Whisper 输出");
  const formattedSubtitles = whisperOutput.segments.map((segment, index) => ({
    id: `subtitle_${index + 1}`,
    start: segment.start,
    end: segment.end,
    originText: segment.text.trim(),
    translatedText: "", // 初始化为空字符串，后续会填充翻译
  }));
  console.log(`格式化完成，共 ${formattedSubtitles.length} 条字幕`);
  console.log("formattedSubtitles", formattedSubtitles);
  return formattedSubtitles;
}

module.exports = { generateSubtitlesWithWhisper };
