// const youtubedl = require("youtube-dl-exec");
const { Readable } = require("stream");
const axios = require("axios");
const FormData = require("form-data");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
ffmpeg.setFfmpegPath(ffmpegPath);
const fs = require('fs');
const path = require('path');
const os = require('os');
const youtubedl = require('youtube-dl-exec');

const API_KEY = process.env.OPENAI_API_KEY;
// const { OPENAI_API_ENDPOINT } = require("../constants");
const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";

async function generateSubtitlesWithWhisper(videoUrl) {
  try {
    console.log("开始生成字幕，视频URL:", videoUrl);

    // 步骤 1: 从 YouTube 视频中提取音频流
    console.log("步骤 1: 开始从 YouTube 视频中提取音频流");
    const audioStream = await extractAudioFromYouTube(videoUrl);
    console.log("步骤 1: 音频流提取完成");

    // 步骤 2: 使用 Whisper API 将音频转换为文字
    console.log("步骤 2: 开始使用 Whisper API 转换音频");
    const whisperResponse = await transcribeAudio(audioStream);
    console.log("步骤 2: Whisper API 转换完成");

    // 步骤 2.5: 检查语言
    if (whisperResponse.language.toLowerCase() !== 'english') {
      throw new Error(`VIDEO_LANGUAGE_ERROR:检测到视频语言为 ${whisperResponse.language}，请上传英文视频`);
    }

    // 步骤 3: 将 Whisper 输出转换为所需的格式
    console.log("步骤 3: 开始格式化字幕");
    const formattedSubtitles = formatSubtitles(whisperResponse);
    console.log("步骤 3: 字幕格式化完成");

    return formattedSubtitles;
  } catch (error) {
    console.error("生成字幕时出错:", error);
    throw error;
  }
}

async function extractAudioFromYouTube(videoUrl) {
  console.log("开始从 YouTube 提取音频");

  const projectRoot = path.resolve(__dirname, '..');
  const outputPath = path.join(projectRoot, `output_${Date.now()}.%(ext)s`);

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
  
    console.log("youtube-dl 输出:", output);
  
    // 查找创建的文件
    const files = fs.readdirSync(projectRoot);
    const createdFile = files.find(file => file.startsWith('output_') && (file.endsWith('.mp3') || file.endsWith('.webm')));
  
    if (createdFile) {
      const fullPath = path.join(projectRoot, createdFile);
      console.log("文件确实被创建了，路径为:", fullPath);
      console.log("文件大小为:", fs.statSync(fullPath).size, "字节");

      // 如果文件是 .webm 格式，我们需要转换它
      if (path.extname(fullPath) === '.webm') {
        const mp3Path = fullPath.replace('.webm', '.mp3');
        await new Promise((resolve, reject) => {
          ffmpeg(fullPath)
            .toFormat('mp3')
            .on('error', (err) => reject(err))
            .on('end', () => {
              fs.unlinkSync(fullPath); // 删除原始的 .webm 文件
              resolve();
            })
            .save(mp3Path);
        });
        console.log("文件已转换为 MP3 格式:", mp3Path);
        return mp3Path;
      }

      return fullPath;
    } else {
      console.log("文件未被创建");
      console.log("目录内容:", files);
      throw new Error("未能创建音频文件");
    }
  } catch (error) {
    console.error("音频提取出错:", error);
    throw error;
  }
}

// async function transcribeAudio(audioFilePath) {
//   console.log("开始准备 Whisper API 请求");
//   const formData = new FormData();
  
//   const audioFile = fs.createReadStream(audioFilePath);
//   formData.append("file", audioFile, { filename: "audio.mp3", contentType: "audio/mpeg" });
//   formData.append("model", "whisper-1");
//   // formData.append("response_format", "verbose_json");
//   // formData.append("timestamps", "true"); 
//   // formData.append("response_format", "srt");
//   formData.append("response_format", "verbose_json");
//   formData.append("timestamp_granularities[]", "segment");

//   try {
//     console.log("发送请求到 Whisper API");
//     console.log("请求大小:", formData.getLengthSync());
//     const response = await axios.post(WHISPER_API_URL, formData, {
//       headers: {
//         ...formData.getHeaders(),
//         Authorization: `Bearer ${API_KEY}`,
//       },
//       maxContentLength: Infinity,
//       maxBodyLength: Infinity,
//       onUploadProgress: (progressEvent) => {  // 添加上传进度
//         console.log(`上传进度: ${Math.round((progressEvent.loaded * 100) / progressEvent.total)}%`);
//       }
//     });

//     // 打印完整响应
//     console.log("完整的 Whisper API 响应:", JSON.stringify(response.data, null, 2));

//     // 删除临时文件
//     fs.unlink(audioFilePath, (err) => {
//       if (err) console.error("删除临时文件失败:", err);
//       else console.log("临时文件已删除");
//     });

//     return response.data;
//   } catch (error) {
//     console.error("Whisper API 调用失败:", error.message);
//     if (error.response) {
//       console.error("响应状态:", error.response.status);
//       console.error("响应数据:", error.response.data);
//     }
//     throw error;
//   }
// }
async function transcribeAudio(audioFilePath) {
  console.log("开始准备 Whisper API 请求");
  const formData = new FormData();
  
  console.log("正在读取音频文件:", audioFilePath);
  const audioFile = fs.createReadStream(audioFilePath);
  formData.append("file", audioFile, { filename: "audio.mp3", contentType: "audio/mpeg" });
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  try {
    console.log("发送请求到 Whisper API");
    // console.log("请求大小:", formData.getLengthSync());
    
    const response = await axios.post(WHISPER_API_URL, formData, {
      headers: {
        ...formData.getHeaders(),
        Authorization: `Bearer ${API_KEY}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      onUploadProgress: (progressEvent) => {  // 添加上传进度
        console.log(`上传进度: ${Math.round((progressEvent.loaded * 100) / progressEvent.total)}%`);
      }
    });

    console.log("Whisper API 响应状态:", response.status);  // 添加这行
    return response.data;
  } catch (error) {
    console.error("Whisper API 调用失败:", error.message);
    if (error.response) {
      console.error("响应状态:", error.response.status);
      console.error("响应数据:", error.response.data);
    } else if (error.request) {
      console.error("请求已发送但没有收到响应");
      console.error("请求详情:", error.request);
    } else {
      console.error("请求配置出错:", error.config);
    }
    throw error;
  } finally {
    // 清理临时文件
    try {
      await fs.promises.unlink(audioFilePath);
      console.log("临时文件已删除:", audioFilePath);
    } catch (err) {
      console.error("删除临时文件失败:", err);
    }
  }
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
