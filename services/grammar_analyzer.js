const { callLLM } = require("./llm_service");

async function analyzeGrammar({ text, context = {} }) {
  try {
    // 1. 判断类型（现在会考虑原文）
    const type = await analyzeType(text, context);
    console.log("内容类型:", type);

    // 2. 根据类型进行分析
    let result;
    switch (type) {
      case "SENTENCE":
        result = await analyzeSentence(text, context);
        break;
      case "PHRASE":
        result = await analyzePhrase(text, context);
        break;
      case "WORD":
        result = await analyzeWord(text, context);
        break;
      default:
        throw new Error(`未知的内容类型: ${type}`);
    }

    return {
      type,
      text,
      ...result,
    };
  } catch (error) {
    console.error("分析过程出错:", error.code || error.message);
    
    // 根据错误类型抛出不同的错误
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      throw {
        code: 'SERVICE_UNAVAILABLE',
        message: '语法分析服务暂时不可用，请稍后重试'
      };
    }
    
    throw {
      code: 'ANALYSIS_ERROR',
      message: '语法分析失败，请重试'
    };
  }
}

// async function analyzeType(text, context) {
//   // 1. 先用简单的词数判断（放在最前面）
//   const wordCount = text.trim().split(/\s+/).length;
//   if (wordCount === 1) {
//     return 'WORD';
//   } else if (wordCount > 1) {
//     return 'PHRASE';
//   }

//   // 2. 然后判断是否完整句子
//   const cleanText = text.trim().replace(/[.,!?]$/, '');
//   const cleanOriginText = context.originText.trim().replace(/[.,!?]$/, '');
//   if (cleanText === cleanOriginText) {
//     return 'SENTENCE';
//   }

//   // 3. 如果还是无法判断，才使用 LLM
//   const prompt = `
// 分析以下内容是短语还是单词。

// 原句：${context.originText}
// 要分析的内容：${text}
// 文章标题：${context.title || "无"}
// 文章描述：${context.description || "无"}

// 只能回答 PHRASE 或 WORD，禁止返回其他任何内容。
// 如果是短语或词组：返回 PHRASE
// 如果是单个单词：返回 WORD
// `;

//   let response = await callLLM(prompt);
//   response = response.trim().toUpperCase();
  
//   // 强制匹配，只接受 PHRASE 或 WORD
//   if (response.includes('PHRASE')) {
//     return 'PHRASE';
//   } else if (response.includes('WORD')) {
//     return 'WORD';
//   } else {
//     // 如果还是无法匹配，使用后备方案
//     return text.split(/\s+/).length > 1 ? 'PHRASE' : 'WORD';
//   }
// }

async function analyzeType(text, context) {
  // 1. 单词判断（最简单直接）
  const wordCount = text.trim().split(/\s+/).length;
  if (wordCount === 1) {
    return 'WORD';
  }

  // 2. 让 LLM 判断是短语还是句子
  const prompt = `
分析以下内容的语法结构：

原句：${context.originText}
要分析的内容：${text}

请判断"要分析的内容"是以下哪种情况：
1. 完整句子：
   - 陈述句（包含主谓结构）
   - 疑问句（以疑问词开头或助动词开头）
   - 祈使句（以动词原形开头）
   - 感叹句（以what/how开头或带感叹号）

2. 短语：
   - 名词短语（如：apple pie, high school）
   - 动词短语（如：be used to, look forward to）
   - 介词短语（如：in the morning, at school）
   - 形容词短语（如：very happy）
   - 副词短语（如：very quickly）

只返回 SENTENCE 或 PHRASE，禁止返回其他内容。
`;

  const response = await callLLM(prompt);
  const type = response.trim().toUpperCase();
  
  return type === 'SENTENCE' ? 'SENTENCE' : 'PHRASE';
}

// 一个通用的 JSON 解析函数
async function parseOpenAIResponse(response) {
  try {
    // 清理响应内容
    const cleanedResponse = response
      .trim()
      .replace(/^`{3}(json)?\s*/, '')  // 移除开头的 ```json 或 ```
      .replace(/`{3}\s*$/, '')         // 移除结尾的 ```
      .trim();
    
    return JSON.parse(cleanedResponse);
  } catch (error) {
    console.error('JSON 解析错误，原始内容:', response);
    throw new Error(`JSON 解析错误: ${error.message}\n原始内容: ${response}`);
  }
}

async function analyzeSentence(text, context) {
  const prompt = `
分析以下句子：

原句：${text}
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}
上文：${context.previous || "无"}
下文：${context.next || "无"}

请提供以下信息，并严格按照 JSON 格式返回，不要包含任何其他字符（包括反引号、换行符等）：

{
  "translation": "中文翻译",
  "grammar": {
    "structure": "语法结构",
    "points": ["语法点1", "语法点2"]
  },
  "vocabulary": [
    {
      "word": "单词",
      "explanation": "解释",
      "usage": "用法"
    }
  ],
  "alternatives": ["相似表达1", "相似表达2"]
}`;

  const response = await callLLM(prompt);
  console.log('OpenAI API 返回的原始内容:', response);
  return parseOpenAIResponse(response);
}

async function analyzePhrase(text, context) {
  const prompt = `
分析以下短语：

原句：${context.originText}
要分析的短语：${text}
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}
上文：${context.previous || "无"}
下文：${context.next || "无"}

请提供以下信息，并严格按照 JSON 格式返回，不要包含任何其他字符（包括反引号、换行符等）：
{
  "translation": "中文翻译",
  "original": "短语的原始形式",
  "role": "在原句中的语法作用",
  "phraseType": "短语类型",
  "usage": "用法说明",
  "examples": ["例句1", "例句2"],
  "alternatives": ["相似表达1", "相似表达2"]
}`;

  const response = await callLLM(prompt);
  console.log('OpenAI API 返回的原始内容:', response);
  return parseOpenAIResponse(response);
}

async function analyzeWord(text, context) {
  const prompt = `
分析以下单词：

原句：${context.originText}
要分析的单词：${text}
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}
上文：${context.previous || "无"}
下文：${context.next || "无"}

请提供以下信息，并严格按照 JSON 格式返回，不要包含任何其他字符（包括反引号、换行符等）：
{
  "translation": "中文翻译",
  "original": "单词的原始形式",
  "phonetic": "音标",
  "roleInSentence": "在原句中的词性和作用",
  "collocations": ["搭配1", "搭配2"],
  "examples": ["原句中的用法", "其他例句1", "其他例句2"],
  "synonyms": ["同义词1", "同义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "etymology": "词源解释"
}`;

  const response = await callLLM(prompt);
  console.log('OpenAI API 返回的原始内容:', response);
  return parseOpenAIResponse(response);
}

module.exports = { analyzeGrammar };