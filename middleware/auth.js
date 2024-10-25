const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  // 从请求头中获取 token
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "无访问权限，请提供 token" });
  }

  try {
    // 验证 token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ message: "无效的 token" });
  }
}

module.exports = authMiddleware;
