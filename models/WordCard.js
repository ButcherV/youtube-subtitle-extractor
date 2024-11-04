const mongoose = require("mongoose");

const WordCardSchema = new mongoose.Schema({
  // 基础信息
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  // 文本和类型
  text: {
    // 选中的文本（单词、短语或句子）
    type: String,
    required: true,
  },

  type: {
    type: String,
    required: true,
    enum: ["SENTENCE", "PHRASE", "WORD"],
  },

  // 语法分析结果
  data: {
    // API 返回的完整分析结果
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },

  // 视频信息（数组，记录单词在所有视频中的出现）
  videoInfos: [{
    videoId: String,      // YouTube 视频 ID
    videoTitle: String,   // 视频标题
    text: String,         // 完整的字幕文本
    startTime: Number,    // 字幕开始时间（毫秒）
    endTime: Number,      // 字幕结束时间（毫秒）
  }],

  // 错题本标记
  isInErrorBook: {
    type: Boolean,
    default: false,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// 索引
WordCardSchema.index({ userId: 1, createdAt: -1 });
WordCardSchema.index({ userId: 1, isInErrorBook: 1 });
// 添加新的索引来加速查找重复单词
WordCardSchema.index({ userId: 1, text: 1, type: 1 });

const WordCard = mongoose.model("WordCard", WordCardSchema);

module.exports = WordCard;