// {
//   "text": "I am going to recommend",  // 必需：要分析的具体内容
//   "context": {                        // 必需
//     "originText": "I am going to recommend that you be expelled",  // 必需：完整的原句
//     "title": "Scent of a Woman",      // 可选：文章标题
//     "description": "A movie about integrity",  // 可选：文章描述
//     "previous": "I have made my decision.",    // 可选：上文
//     "next": "that you be expelled."            // 可选：下文
//   }
// }

const express = require('express');
const router = express.Router();
const { analyzeGrammar } = require('../services/grammar_analyzer');
const authMiddleware = require('../middleware/auth'); 

router.post('/analyze', authMiddleware, async (req, res) => {
  console.log('收到请求：/grammar/analyze');
  console.log('请求体：', req.body);
  try {
    const { text, context } = req.body;
    const userId = req.user.userId;

    // 验证必需的字段
    if (!text) {
      return res.status(400).json({ error: 'MISSING_TEXT' });
    }
    if (!context?.originText) {
      return res.status(400).json({ error: 'MISSING_ORIGIN_TEXT' });
    }

    console.log('用户ID：', userId);
    console.log('要分析的文本：', text);
    console.log('原文：', context.originText);
    console.log('其他上下文：', context);

    const result = await analyzeGrammar({ text, context, userId });
    res.json(result);
  } catch (error) {
    console.error('语法分析错误:', error);
    res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
  }
});

module.exports = router;