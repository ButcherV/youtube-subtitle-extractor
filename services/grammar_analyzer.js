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
    console.error("分析过程出错:", error);
    throw error;
  }
}

async function analyzeType(text, context) {
  // 清理文本（去除标点符号和多余空格）后再比较
  const cleanText = text.trim().replace(/[.,!?]$/, '');
  const cleanOriginText = context.originText.trim().replace(/[.,!?]$/, '');

  // 如果清理后的文本相同，就是完整句子
  if (cleanText === cleanOriginText) {
    return 'SENTENCE';
  }

  // 如果不完全相同，再用 LLM 判断类型
  const prompt = `
分析以下内容是短语还是单词：

原句：${context.originText}
要分析的内容：${text}
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}

请判断"要分析的内容"是：
1. 短语或不完整的句子（是原句的一部分）
2. 单个单词

只返回以下某一个值：PHRASE 或 WORD
`;

  const response = await callLLM(prompt);
  return response.trim();
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
  "type": "短语类型",
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
  "forms": {
    "original": "原型",
    "past": "过去式",
    "pastParticiple": "过去分词",
    "present": "现在分词"
  },
  "meanings": ["释义1", "释义2"],
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