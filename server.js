const express = require("express");
const cors = require("cors");
const fs = require("fs").promises;
const { getSubtitles } = require("./youtube_subtitle_extractor");

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

app.post("/extract-subtitles", async (req, res) => {
  const { videoUrl } = req.body;

  if (!videoUrl) {
    return res.status(400).json({ error: "缺少 videoUrl 参数" });
  }

  try {
    const { srtContent, tempFilePath } = await getSubtitles(videoUrl);
    res.json({ subtitles: srtContent, filePath: tempFilePath });

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
    console.error("获取字幕时出错:", error.message);
    res.status(500).json({ error: "获取字幕时出错" });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});