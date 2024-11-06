const express = require("express");
const router = express.Router();
const WordCard = require("../models/WordCard");
const authMiddleware = require("../middleware/auth");

// 文本标准化函数
function normalizeText(text) {
  return text
    .trim() // 去除前后空格
    .toLowerCase() // 转小写
    .replace(/\s+/g, " "); // 多个空格变单个
}

// POST /wordcard/save - 保存单词卡片
router.post("/save", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    let { text, type, data, videoInfo } = req.body;

    // 1. 请求参数验证
    if (!text || !type || !data || !videoInfo) {
      return res.status(400).json({
        error: "MISSING_REQUIRED_FIELDS",
        message: "缺少必要字段",
      });
    }

    // 2. videoInfo 必要字段验证
    if (!videoInfo.videoId) {
      return res.status(400).json({
        error: "INVALID_VIDEO_INFO",
        message: "缺少视频ID",
      });
    }

    // 确保 startTime 和 endTime 是数字
    videoInfo.startTime = Number(videoInfo.startTime);
    videoInfo.endTime = Number(videoInfo.endTime);

    if (isNaN(videoInfo.startTime) || isNaN(videoInfo.endTime)) {
      return res.status(400).json({
        error: "INVALID_VIDEO_INFO",
        message: "视频时间格式错误",
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
      type,
    });

    if (existingCard) {
      // 检查是否已存在相同的视频片段
      const isDuplicate = existingCard.videoInfos.some(
        (info) =>
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
          message: "添加了新的视频信息", // 告诉前端添加了新数据
        });
      } else {
        // 如果是重复片段，返回已存在提示
        res.json({
          success: true,
          wordCard: existingCard,
          message: "该视频片段已存在", // 告诉前端数据已存在
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
        isInErrorBook: false,
      });
      await wordCard.save();
      res.json({
        success: true,
        wordCard,
        message: "创建了新的单词卡片", // 告诉前端创建了新卡片
      });
    }
  } catch (error) {
    console.error("保存单词卡片失败:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

// GET /wordcard/stats - 获取各类型数量统计
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;

    // 使用聚合查询一次性获取所有统计
    const stats = await Promise.all([
      // 单词总数
      WordCard.countDocuments({ userId, type: "WORD" }),
      // 词组总数
      WordCard.countDocuments({ userId, type: "PHRASE" }),
      // 句子总数
      WordCard.countDocuments({ userId, type: "SENTENCE" }),
      // 错题总数
      WordCard.countDocuments({ userId, isInErrorBook: true }),
    ]);

    res.json({
      success: true,
      data: {
        words: stats[0],
        phrases: stats[1],
        sentences: stats[2],
        errorBook: stats[3],
      },
    });
  } catch (error) {
    console.error("获取统计数据失败:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

// GET /wordcard/list - 获取单词卡片列表
// GET /wordcard/list?type=WORD
// GET /wordcard/list?isInErrorBook=true
// GET /wordcard/list?type=SENTENCE
router.get("/list", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, isInErrorBook } = req.query;

    // 构建查询条件
    const query = { userId };
    
    // 如果指定了类型，添加类型筛选
    if (type) {
      query.type = type;
    }

    // 如果指定了错题本状态，添加错题本筛选
    if (isInErrorBook !== undefined) {
      query.isInErrorBook = isInErrorBook === 'true';
    }

    // 获取数据
    const wordCards = await WordCard.find(query)
      .sort({ createdAt: -1 });  // 按创建时间倒序

    res.json({
      success: true,
      data: wordCards
    });

  } catch (error) {
    console.error("获取单词卡片列表失败:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

// PUT /wordcard/toggle-error-book/:id - 切换错题本状态
router.put("/toggle-error-book/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const cardId = req.params.id;

    // 查找该用户的这条记录
    const wordCard = await WordCard.findOne({ _id: cardId, userId });

    if (!wordCard) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "未找到该记录"
      });
    }

    // 切换错题本状态
    wordCard.isInErrorBook = !wordCard.isInErrorBook;
    await wordCard.save();

    res.json({
      success: true,
      data: wordCard,
      message: wordCard.isInErrorBook ? "已加入复习清单" : "已从复习清单中移除"
    });

  } catch (error) {
    console.error("更新复习清单状态失败:", error);
    res.status(500).json({ 
      error: "INTERNAL_SERVER_ERROR",
      message: "服务器内部错误"
    });
  }
});

module.exports = router;
