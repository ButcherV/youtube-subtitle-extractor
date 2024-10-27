require("dotenv").config();
const ytdl = require("ytdl-core");
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const { getSubtitles } = require("./services/youtube_subtitle_extractor");
const { translateSubtitles } = require("./services/translate_services");
const { analyzeGrammar } = require("./services/grammar_analysis");
const { extractVideoMetadata } = require("./services/youtube_metadata_extractor");
const { generateSubtitlesWithWhisper } = require("./services/whisper_subtitle_generator");
const { processVideo } = require("./services/video_processor");
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const authMiddleware = require('./middleware/auth');

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Could not connect to MongoDB', err));

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// 提取并翻译字幕 API 端点
app.post("/extract-and-translate-subtitles", authMiddleware, async (req, res) => {
  const { videoUrl, targetLanguage = "zh" } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "缺少 videoUrl 参数" });
  }

  try {
    // 步骤1：获取视频信息和提取字幕
    const info = await ytdl.getInfo(videoUrl);
    let { 
      parsedSubtitles
      // tempFilePath 
    } = await getSubtitles(info);

    console.log("parsedSubtitles1", parsedSubtitles);

    // 步骤2：如果没有字幕，使用 Whisper 生成
    if (!parsedSubtitles || parsedSubtitles.length === 0) {
      console.log("未找到自带字幕，使用 Whisper 生成...");
      parsedSubtitles = await generateSubtitlesWithWhisper(videoUrl);
    }
    console.log("parsedSubtitles2", parsedSubtitles);

    // 步骤 3：提取元数据并翻译字幕
    const metadata = await extractVideoMetadata(info);
    const translatedSubtitles = await translateSubtitles(
      parsedSubtitles,
      targetLanguage,
      metadata.videoTitle,
      metadata.videoDescription
    );

    res.json({
      subtitles: translatedSubtitles,
      metadata: metadata,
    });

    // 在响应发送后删除临时文件
    // res.on("finish", async () => {
    //   try {
    //     await fs.unlink(tempFilePath);
    //     console.log(`临时文件已删除: ${tempFilePath}`);
    //   } catch (error) {
    //     console.error(`删除临时文件时出错: ${error.message}`);
    //   }
    // });
  } catch (error) {
    console.error("获取或翻译字幕时出错:", error.message);
    res.status(500).json({ error: "获取或翻译字幕时出错" });
  }
});

// 语法分析 API 端点
app.post("/analyze-grammar", authMiddleware, async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "缺少文本参数" });
  }

  try {
    const analysis = await analyzeGrammar(text);
    res.json({ analysis });
  } catch (error) {
    console.error("语法分析出错:", error.message);
    res.status(500).json({ error: "语法分析出错" });
  }
});

// 处理视频 API
// 传参：一次性处理 meta/subtitles/grammer
// 不传参：返回用户的所有处理过的视频列表
app.post("/process-video", authMiddleware, async (req, res) => {
  const { videoUrl, targetLanguage = "zh" } = req.body;
  const userId = req.user.userId; // 假设 authMiddleware 已经将用户信息附加到 req.user

  try {
    if (!videoUrl) {
      // 如果没有提供 videoUrl，返回用户的所有处理过的视频列表
      const processedVideos = await ProcessedVideo.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)  // 限制返回数量，可以根据需求调整
        .select('videoId data.meta');  // 只选择需要的字段
      return res.json(processedVideos);
    }

    // 如果提供了 videoUrl，执行原有的视频处理逻辑
    const result = await processVideo(videoUrl, targetLanguage, userId);
    res.json(result);
  } catch (error) {
    console.error("处理视频时出错:", error.message);
    res.status(500).json({ error: "处理视频时出错" });
  }
});

//  auth: 注册、登录相关的路由
app.use('/auth', authRoutes);

// user: 用户相关的路由
app.use('/user', userRoutes);

app._router.stack.forEach(function(r){
  if (r.route && r.route.path){
    console.log(r.route.path)
  }
})

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
