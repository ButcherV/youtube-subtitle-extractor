const express = require("express");
const router = express.Router();
const WordCard = require("../models/WordCard");
const authMiddleware = require("../middleware/auth");

// 文本标准化函数
function normalizeText(text) {
  return text
    .trim()                    // 去除前后空格
    .toLowerCase()             // 转小写
    .replace(/\s+/g, ' ');    // 多个空格变单个
}

// POST /wordcard/save - 保存单词卡片
router.post("/save", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { text, type, data, videoInfo } = req.body;

    // 1. 请求参数验证
    if (!text || !type || !data || !videoInfo) {
      return res.status(400).json({ 
        error: 'MISSING_REQUIRED_FIELDS',
        message: '缺少必要字段'
      });
    }

    // 2. videoInfo 必要字段验证
    if (!videoInfo.videoId || !videoInfo.startTime || !videoInfo.endTime) {
      return res.status(400).json({ 
        error: 'INVALID_VIDEO_INFO',
        message: '视频信息不完整'
      });
    }


    // 标准化文本
    text = normalizeText(text);
    if (videoInfo.text) {
      videoInfo.text = normalizeText(videoInfo.text);
    }

    // 先查找是否已存在相同的文本
    const existingCard = await WordCard.findOne({
      userId,
      text,
      type
    });

    if (existingCard) {
      // 检查是否已存在相同的视频片段
      const isDuplicate = existingCard.videoInfos.some(info => 
        info.videoId === videoInfo.videoId && 
        info.startTime === videoInfo.startTime &&
        info.endTime === videoInfo.endTime
      );

      if (!isDuplicate) {
        // 如果不是重复片段，添加新的视频信息
        existingCard.videoInfos.push(videoInfo);
        await existingCard.save();
        res.json({ 
          success: true, 
          wordCard: existingCard,
          message: '添加了新的视频信息'  // 告诉前端添加了新数据
        });
      } else {
        // 如果是重复片段，返回已存在提示
        res.json({ 
          success: true, 
          wordCard: existingCard,
          message: '该视频片段已存在'  // 告诉前端数据已存在
        });
      }
    } else {
      // 如果不存在，创建新记录
      const wordCard = new WordCard({
        userId,
        text,
        type,
        data,
        videoInfos: [videoInfo],
        isInErrorBook: false
      });
      await wordCard.save();
      res.json({ 
        success: true, 
        wordCard,
        message: '创建了新的单词卡片'  // 告诉前端创建了新卡片
      });
    }

  } catch (error) {
    console.error("保存单词卡片失败:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

module.exports = router;