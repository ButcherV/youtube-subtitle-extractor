const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 更新错误代码和成功代码
const ERROR_KEYS = {
  EMAIL_ALREADY_EXISTS: "EMAIL_ALREADY_EXISTS",
  INVALID_VERIFICATION_CODE: "INVALID_VERIFICATION_CODE",
  VERIFICATION_CODE_EXPIRED: "VERIFICATION_CODE_EXPIRED",
  REGISTRATION_FAILED: "REGISTRATION_FAILED",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  INCORRECT_PASSWORD: "INCORRECT_PASSWORD",
  LOGIN_FAILED: "LOGIN_FAILED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  LOGOUT_FAILED: "LOGOUT_FAILED",
};

const SUCCESS_KEYS = {
  REGISTRATION_SUCCESS: "REGISTRATION_SUCCESS",
  VERIFICATION_CODE_SENT: "VERIFICATION_CODE_SENT",
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGOUT_SUCCESS: "LOGOUT_SUCCESS",
};

// 【注册】- 请求发送验证码 API
const verificationCodes = new Map(); // 创建一个简单的内存存储来保存验证码
// 配置邮件发送器
// const transporter = nodemailer.createTransport({
//   service: 'gmail',
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   },
//   tls: {
//     rejectUnauthorized: false
//   }
// });
router.post('/request-verification', async (req, res) => {
  try {
    const { email } = req.body;

    // 检查邮箱是否已注册
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: ERROR_KEYS.EMAIL_ALREADY_EXISTS });
    }

    // 生成验证码
    const verificationCode = crypto.randomInt(100000, 999999).toString();

    // 存储验证码（5分钟后过期）
    verificationCodes.set(email, {
      code: verificationCode,
      expiry: Date.now() + 5 * 60 * 1000
    });

    // 发送验证码邮件
    // await transporter.sendMail({
    //   from: '"Your App Name" <noreply@yourapp.com>',
    //   to: email,
    //   subject: "注册验证码",
    //   text: `您的注册验证码是: ${verificationCode}`,
    //   html: `<b>您的注册验证码是: ${verificationCode}</b>`,
    // });

    console.log(`验证码 for ${email}: ${verificationCode}`); // 临时日志，方便测试

    res.status(200).json({ success: SUCCESS_KEYS.VERIFICATION_CODE_SENT });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ error: ERROR_KEYS.INTERNAL_SERVER_ERROR });
  }
});

// 【注册】- 注册功能路由
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, verificationCode } = req.body;

    // 检查验证码是否有效
    const storedVerification = verificationCodes.get(email);
    if (!storedVerification || storedVerification.code !== verificationCode) {
      return res.status(400).json({ error: ERROR_KEYS.INVALID_VERIFICATION_CODE });
    }
    if (Date.now() > storedVerification.expiry) {
      return res.status(400).json({ error: ERROR_KEYS.VERIFICATION_CODE_EXPIRED });
    }

    // 再次检查邮箱是否已被注册（以防并发注册）
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: ERROR_KEYS.EMAIL_ALREADY_EXISTS });
    }

    // 对密码进行加密
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建新用户
    const newUser = new User({
      username,
      email,
      password: hashedPassword
    });

    await newUser.save();

    // 删除已使用的验证码
    verificationCodes.delete(email);

    res.status(201).json({ success: SUCCESS_KEYS.REGISTRATION_SUCCESS });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: ERROR_KEYS.REGISTRATION_FAILED });
  }
});

// 【登录】- 登录功能路由
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 查询用户
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: ERROR_KEYS.USER_NOT_FOUND });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ error: ERROR_KEYS.INCORRECT_PASSWORD });
    }

    // 生成 JWT
    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // 返回 token
    res.status(200).json({ success: SUCCESS_KEYS.LOGIN_SUCCESS, token, userId: user._id, email: user.email });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: ERROR_KEYS.LOGIN_FAILED });
  }
});

// 【登出】- 登出功能路由
router.post('/logout', (req, res) => {
  try {
    // 直接返回成功消息
    res.status(200).json({ success: SUCCESS_KEYS.LOGOUT_SUCCESS });
  } catch (error) {
    res.status(500).json({ error: ERROR_KEYS.LOGOUT_FAILED });
  }
});

module.exports = router;