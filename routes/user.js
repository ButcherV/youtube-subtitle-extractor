const express = require("express");
const router = express.Router();
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

// 获取用户详细信息的 API
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select("-password"); // 排除密码字段

    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND" });
    }
    res.json({ user });
  } catch (error) {
    console.error("获取用户信息错误:", error);
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR" });
  }
});

module.exports = router;
