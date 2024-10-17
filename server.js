require('dotenv').config();
const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const { getSubtitles } = require("./services/youtube_subtitle_extractor");
console.log("getSubtitles type:", typeof getSubtitles);
console.log("getSubtitles:", getSubtitles);
const { translateSubtitles } = require("./services/translate_services");

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

app.post("/extract-and-translate-subtitles", async (req, res) => {
  const { videoUrl, targetLanguage = 'zh' } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "缺少 videoUrl 参数" });
  }

  try {
    const { parsedSubtitles, tempFilePath } = await getSubtitles(videoUrl);
    
    // 翻译字幕
    const translatedSubtitles = await translateSubtitles(parsedSubtitles, targetLanguage);

    res.json({ subtitles: translatedSubtitles, filePath: tempFilePath });

    // 在响应发送后删除临时文件
    res.on('finish', async () => {
      try {
        await fs.unlink(tempFilePath);
        console.log(`临时文件已删除: ${tempFilePath}`);
      } catch (error) {
        console.error(`删除临时文件时出错: ${error.message}`);
      }
    });
  } catch (error) {
    console.error("获取或翻译字幕时出错:", error.message);
    res.status(500).json({ error: "获取或翻译字幕时出错" });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});