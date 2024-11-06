const express = require('express');
const router = express.Router();
const ytdl = require('ytdl-core');
const ProcessedVideo = require('../models/ProcessedVideo');
const authMiddleware = require('../middleware/auth');

// 视频检查路由
router.post("/check-video", authMiddleware, async (req, res) => {
  try {
    const { videoId, url } = req.body;
    const userId = req.user.userId;

    // 检查 1 -基础参数验证（为前端兜底）
    if (!videoId?.trim() || !url?.trim()) {
      return res.status(400).json({
        success: false,
        message: "参数不完整",
      });
    }

    // 通过 ytdl-core 获取视频信息
    const videoInfo = await ytdl.getInfo(url);

    // 检查 2 -检查视频时长（单位：秒）
    const duration = parseInt(videoInfo.videoDetails.lengthSeconds);
    if (duration > 600) { // 10分钟限制
      return res.status(400).json({
        success: false,
        message: "视频超过10分钟",
      });
    }

    // 检查 3 - 检查是否为英文视频
    // 此时做不了检查，通过字幕、标题来判断都是不严谨的。
    // 放到 whisper_subtitle_generator 里来做。

    // 检查 4 - 检查是否已处理过这个视频（为前端兜底）
    const existingVideo = await ProcessedVideo.findOne({ userId, videoId });
    if (existingVideo) {
      return res.status(400).json({
        success: false,
        message: "该视频已经添加过了",
      });
    }

    // 检查 5 - 视频可用性检查
    if (videoInfo.videoDetails.isPrivate) {
      return res.status(400).json({
        success: false,
        message: "视频必须是公开的",
      });
    }

    return res.json({
      success: true,
      data: {
        title: videoInfo.videoDetails.title,
        duration,
        thumbnail: videoInfo.videoDetails.thumbnails[0].url, // 获取第一个缩略图
      },
      message: "视频检查通过",
    });
  } catch (error) {
    console.error("视频检查失败:", error);
    
    // ytdl-core 特定错误处理
    // 检查 6 -videoId 不正确、视频不存在或已被删除
    if (error.message.includes('Video unavailable')) {
      return res.status(404).json({
        success: false,
        message: "视频不存在或已被删除",
      });
    }

    return res.status(500).json({
      success: false,
      message: "视频检查失败，请稍后重试",
    });
  }
});

module.exports = router;