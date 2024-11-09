const RateLimiter = require("../services/rate_limiter");

// 创建不同类型的限流中间件
const createLimiter = (type) => async (req, res, next) => {
  const userId = req.user?.userId || req.ip;  // 已登录用户用 userId，未登录用户用 IP

  try {
    await RateLimiter.api[type](async () => {
      return true;  // 只是检查限流，不做任何事
    }, userId);
    
    next();
  } catch (error) {
    if (error.code === "RATE_LIMITED") {
      console.log(`用户 ${userId} 触发 ${type} 接口限流`);
      res.status(429).json({
        success: false,
        message: "请求过于频繁，请稍后再试",
        retryAfter: error.retryAfter
      });
    } else {
      next(error);
    }
  }
};

// 导出三种不同类型的限流中间件
module.exports = {
  normalLimiter: createLimiter('normal'),
  sensitiveLimiter: createLimiter('sensitive'),
  resourceLimiter: createLimiter('resource')
};