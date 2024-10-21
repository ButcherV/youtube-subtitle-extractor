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

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// 提取并翻译字幕 API 端点
app.post("/extract-and-translate-subtitles", async (req, res) => {
  const { videoUrl, targetLanguage = "zh" } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "缺少 videoUrl 参数" });
  }

  try {
    // 步骤1：获取视频信息和提取字幕
    const info = await ytdl.getInfo(videoUrl);
    const { 
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
app.post("/analyze-grammar", async (req, res) => {
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

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
