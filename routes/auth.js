const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');


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

// 【注册】- 请求发送验证码 API
const verificationCodes = new Map(); // 创建一个简单的内存存储来保存验证码
router.post('/request-verification', async (req, res) => {
  try {
    const { email } = req.body;

    // 检查邮箱是否已注册
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '该邮箱已被注册' });
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

    res.status(200).json({ message: '验证码已发送' });
  } catch (error) {
    console.error('发送验证码错误:', error);
    res.status(500).json({ message: '发送验证码失败，请稍后重试' });
  }
});

// 【注册】- 注册功能路由
router.post('/register', async (req, res) => {
  try {
    const { email, password, verificationCode } = req.body;

    // 检查验证码是否有效
    const storedVerification = verificationCodes.get(email);
    if (!storedVerification || storedVerification.code !== verificationCode || Date.now() > storedVerification.expiry) {
      return res.status(400).json({ message: '验证码无效或已过期' });
    }

    // 再次检查邮箱是否已被注册（以防并发注册）
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '该邮箱已被注册' });
    }

    // 对密码进行加密
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // 创建新用户
    const newUser = new User({
      email,
      password: hashedPassword
    });

    await newUser.save();

    // 删除已使用的验证码
    verificationCodes.delete(email);

    res.status(201).json({ message: '注册成功' });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: '注册失败，请稍后重试' });
  }
});
module.exports = router;