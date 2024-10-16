const express = require("express");
const cors = require("cors");
const { getSubtitles } = require("./subtitleExtractor");

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
    const subtitles = await getSubtitles(videoUrl);
    res.json({ subtitles });
  } catch (error) {
    console.error("获取字幕时出错:", error.message);
    res.status(500).json({ error: "获取字幕时出错" });
  }
});

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
