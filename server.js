require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { processVideo } = require("./services/video_processor");
const { cleanupTempFiles } = require('./services/cleanup_service');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const authMiddleware = require('./middleware/auth');
const ProcessedVideo = require('./models/ProcessedVideo');
const grammarRoutes = require('./routes/grammar');
const wordcardRoutes = require('./routes/wordcard');
const videoRoutes = require('./routes/video-check');

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log('Connected to MongoDB'))
.catch((err) => console.error('Could not connect to MongoDB', err));

const app = express();
const port = 3000;

app.use(express.json());
app.use(cors());

// 处理视频 API
// 传参：一次性处理该视频的 meta/subtitles
// 不传参：返回用户所有处理过的视频的 meta/subtitles
app.post("/process-video", authMiddleware, async (req, res) => {
  const { videoUrl, targetLanguage = "zh" } = req.body;
  const userId = req.user.userId; // 假设 authMiddleware 已经将用户信息附加到 req.user

  try {
    if (!videoUrl) {
      // 如果没有提供 videoUrl，返回用户的所有处理过的视频列表
      const processedVideos = await ProcessedVideo.find({ userId })
        .sort({ createdAt: -1 })
        .limit(20)  // 限制返回数量，可以根据需求调整
        // .select('videoId data.meta');  // 只选择需要的字段
      return res.json(processedVideos);
    }

    // 如果提供了 videoUrl，执行原有的视频处理逻辑
    const result = await processVideo(videoUrl, targetLanguage, userId);
    res.json(result);
  } catch (error) {
    console.error("处理视频时出错:", error.message);
    res.status(400).json({ 
      success: false,
      message: error.message  // 保留原始错误信息
    });
  }
});

// 服务启动时执行一次清理(之前下载的过期音视频)
cleanupTempFiles().catch(err => {
  console.error('启动时清理临时文件失败:', err);
});

// 每小时执行一次清理(之前下载的过期音视频)
setInterval(() => {
  cleanupTempFiles().catch(err => {
    console.error('定时清理临时文件失败:', err);
  });
}, 3600000); // 1小时

//  auth: 注册、登录相关的路由
app.use('/auth', authRoutes);

// user: 用户相关的路由
app.use('/user', userRoutes);


app.use('/grammar', grammarRoutes);

app.use('/wordcard', wordcardRoutes);

// 视频检查相关
app.use('/video', videoRoutes); 

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});
