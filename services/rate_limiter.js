const { RateLimiterMemory } = require('rate-limiter-flexible');

// 限流器配置
const RATE_LIMITS = {
  // OpenAI API 总体限制
  OPENAI: {
    GPT: {
      points: 500,      // 所有用户每分钟总共 500 次
      duration: 60,     // 60 秒为一个周期
      blockDuration: 5  // 超限后封禁 5 秒
    },
    GPT_BATCH: {
      points: 400,
      duration: 30,
      blockDuration: 5
    },
    WHISPER: {
      points: 50,       // 所有用户每分钟总共 50 次
      duration: 60,
      blockDuration: 5
    }
  },
  
  // 每个用户的 OpenAI API 限制
  USER_OPENAI: {
    GPT: {
      points: 10,       // 每用户每分钟 10 次
      duration: 60,
      blockDuration: 5
    },
    GPT_BATCH: {       // 新增批量任务的用户限流
      points: 200,       // 允许更多并发
      duration: 30,
      blockDuration: 5
    },
    WHISPER: {
      points: 5,        // 每用户每分钟 5 次
      duration: 60,
      blockDuration: 5
    }
  },

  // 每个用户的普通 API 限制
  USER_API: {
    NORMAL: {          // 普通接口（如获取列表）
      points: 100,     // 每用户每分钟 100 次
      duration: 60,
      blockDuration: 5
    },
    SENSITIVE: {       // 敏感接口（如登录）
      points: 20, 
      duration: 60,
      blockDuration: 30
    },
    RESOURCE: {        // 资源密集型（如视频处理）
      points: 10,
      duration: 60,
      blockDuration: 10
    }
  }
};

// 限流器实例缓存
const limiters = new Map();

// 获取或创建限流器
function getLimiter(category, type) {
  const key = `${category}_${type}`;
  
  if (!limiters.has(key)) {
    const config = RATE_LIMITS[category]?.[type];
    if (!config) {
      throw new Error(`未知的限流器类型: ${category}.${type}`);
    }
    limiters.set(key, new RateLimiterMemory(config));
  }
  
  return limiters.get(key);
}

// 通用的限流包装函数
async function withRateLimit(category, type, fn, userId = null) {
  try {
    // 1. 检查全局限制（仅 OpenAI API 需要）
    if (category === 'OPENAI') {
      const globalLimiter = getLimiter('OPENAI', type);
      await globalLimiter.consume('GLOBAL');
    }

    // 2. 检查用户限制
    if (userId) {
      const userCategory = category === 'OPENAI' ? 'USER_OPENAI' : 'USER_API';
      const userLimiter = getLimiter(userCategory, type);
      await userLimiter.consume(userId);
    }

    // 3. 执行实际函数
    return await fn();
  } catch (error) {
    if (error.consumedPoints) {
      const retryAfter = Math.round(error.msBeforeNext / 1000) || 1;
      const rateLimitError = new Error("请求过于频繁");
      rateLimitError.code = 'RATE_LIMITED';
      rateLimitError.retryAfter = retryAfter;
      
      console.log('----------------------------------------');
      console.log(`⚠️ API 限流触发`);
      console.log(`⏳ 等待时间: ${retryAfter} 秒`);
      console.log(`👤 用户 ID: ${userId || 'GLOBAL'}`);
      console.log(`🔄 类型: ${category}.${type}`);
      console.log('----------------------------------------');
      
      throw rateLimitError;
    }
    throw error;
  }
}

// 便捷方法
const RateLimiter = {
  // OpenAI API 限流
  openai: {
    gpt: (fn, userId) => withRateLimit('OPENAI', 'GPT', fn, userId),
    gpt_batch: (fn, userId) => withRateLimit('OPENAI', 'GPT_BATCH', fn, userId),
    whisper: (fn, userId) => withRateLimit('OPENAI', 'WHISPER', fn, userId)
  },
  
  // 自定义 API 限流
  api: {
    normal: (fn, userId) => withRateLimit('USER_API', 'NORMAL', fn, userId),
    sensitive: (fn, userId) => withRateLimit('USER_API', 'SENSITIVE', fn, userId),
    resource: (fn, userId) => withRateLimit('USER_API', 'RESOURCE', fn, userId)
  }
};

module.exports = RateLimiter;