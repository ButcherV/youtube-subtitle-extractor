const { callLLM } = require("./llm_service");

async function analyzeGrammar({ text, context = {} }) {
  try {
    // 1. 判断类型
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
  const prompt = `
分析以下内容是句子、短语还是单词：
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}
内容：${text}
下文：${context.next || "无"}

请判断"内容"是：
1. 完整的句子
2. 短语或不完整的句子
3. 单个单词

只返回以下某一个值：SENTENCE, PHRASE, 或 WORD
`;

  const response = await callLLM(prompt);
  return response.trim();
}

async function analyzeSentence(text, context) {
  const prompt = `
分析以下句子：
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}
上文：${context.previous || "无"}
句子：${text}
下文：${context.next || "无"}

请提供以下信息：
1. 中文翻译
2. 语法结构分析
3. 涉及的语法知识点
4. 重点词汇解释
5. 相似表达方式

按以下 JSON 格式返回：
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
}
`;

  const response = await callLLM(prompt);
  return JSON.parse(response);
}

async function analyzeWord(text, context) {
  const prompt = `
分析以下单词：
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}
上文：${context.previous || "无"}
单词：${text}
下文：${context.next || "无"}

请提供以下信息：
1. 音标
2. 所有词形
3. 中文释义
4. 常见搭配
5. 例句
6. 同义词/反义词
7. 词源解释

按以下 JSON 格式返回：
{
  "phonetic": "音标",
  "forms": {
    "original": "原型",
    "past": "过去式",
    "pastParticiple": "过去分词",
    "present": "现在分词"
  },
  "meanings": ["释义1", "释义2"],
  "collocations": ["搭配1", "搭配2"],
  "examples": ["例句1", "例句2"],
  "synonyms": ["同义词1", "同义词2"],
  "antonyms": ["反义词1", "反义词2"],
  "etymology": "词源解释"
}
`;

  const response = await callLLM(prompt);
  return JSON.parse(response);
}

async function analyzePhrase(text, context) {
  const prompt = `
分析以下短语：
文章标题：${context.title || "无"}
文章描述：${context.description || "无"}
短语：${text}

请提供以下信息：
1. 中文翻译
2. 短语类型
3. 用法说明
4. 例句
5. 相似表达

请严格按照以下 JSON 格式返回，不要包含任何其他内容：
{
  "translation": "中文翻译",
  "type": "短语类型（如动词短语、名词短语等）",
  "usage": "用法说明",
  "examples": ["例句1", "例句2"],
  "alternatives": ["相似表达1", "相似表达2"]
}`;

  const response = await callLLM(prompt);
  console.log('OpenAI API 返回的原始内容:', response);  // 添加这行
  try {
    return JSON.parse(response);
  } catch (error) {
    console.error('JSON 解析错误，原始内容:', response);
    throw error;
  }
}

module.exports = { analyzeGrammar };
