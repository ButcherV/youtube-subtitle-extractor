const express = require('express');
const router = express.Router();
const { analyzeGrammar } = require('../services/grammar_analyzer');
const authMiddleware = require('../middleware/auth'); 

router.post('/analyze', authMiddleware, async (req, res) => {
  console.log('收到请求：/grammar/analyze');
  console.log('请求体：', req.body);
  try {
    const { text, context } = req.body;
    const userId = req.user.userId;  // 获取用户ID，用于记录或限制

    console.log('用户ID：', userId);  // 添加
    console.log('文本：', text);  // 添加
    console.log('上下文：', context);

    if (!text) {
      return res.status(400).json({ error: 'MISSING_TEXT' });
    }

    const result = await analyzeGrammar({ text, context, userId });
    res.json(result);
  } catch (error) {
    console.error('语法分析错误:', error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;