const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

const verificationCodes = {}; // <-- Add this to fix the error

// @route POST /api/auth/signup/send-code
router.post('/signup/send-code', async (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) return res.status(400).json({ msg: 'Name and email are required' });

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'User with this email already exists' });

    const nameTaken = await User.findOne({ name });
    if (nameTaken) return res.status(400).json({ msg: 'This name is already taken' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    verificationCodes[email] = { code, name, createdAt: Date.now() };

    await sendEmail({
      to: email,
      subject: 'Your IyonicPay Verification Code',
      html: `<p>Hello ${name},</p><p>Your verification code is:</p><h2>${code}</h2><p>This code expires in 10 minutes.</p>`
    });

    res.json({ msg: 'Verification code sent to your email. Please check the your spam folder' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error sending code' });
  }
});

// @route POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password, code } = req.body;
  if (!name || !email || !password || !code) {
    return res.status(400).json({ msg: 'All fields including verification code are required' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: 'User already exists' });

    const record = verificationCodes[email];
    if (!record || record.code !== code || record.name !== name) {
      return res.status(400).json({ msg: 'Invalid or expired verification code' });
    }

    if (Date.now() - record.createdAt > 10 * 60 * 1000) {
      return res.status(400).json({ msg: 'Verification code expired' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hash });
    await user.save();

    delete verificationCodes[email]; // Clean up after success

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    await sendEmail({
      to: email,
     subject: '🎉 Welcome to IyonicPay!',
html: `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
    <h2 style="color: #4F46E5;">Hi ${name},</h2>
    <p>🎉 <strong>Welcome to IyonicPay!</strong> Your account has been successfully created and you're now part of a smarter, faster way to handle money.</p>

    <h3 style="margin-top: 20px; color: #111827;">What is IyonicPay?</h3>
    <p>IyonicPay is your all-in-one digital wallet built for individuals and businesses across Africa and beyond. With IyonicPay, you can:</p>
    <ul style="line-height: 1.6;">
      <li>✅ <strong>Send & receive money</strong> instantly to anyone using email.</li>
      <li>✅ <strong>Request payments</strong> with unique, shareable links.</li>
      <li>✅ <strong>Withdraw funds</strong> via bank transfer, M-Pesa, PayPal, and more.</li>
      <li>✅ <strong>Track your transactions</strong> and balances in real time.</li>
      <li>✅ <strong>Request refunds</strong> within 24 hours of sending money.</li>
    </ul>

    <h3 style="margin-top: 20px; color: #111827;">💼 Why choose IyonicPay?</h3>
    <ul style="line-height: 1.6;">
      <li>🔒 Bank-level security and encryption.</li>
      <li>🌍 Cross-border friendly with support for multiple currencies (USD, KES, NGN, etc).</li>
      <li>📈 Designed for freelancers, startups, creators, and everyday users.</li>
      <li>📬 Friendly support and fast transaction resolutions.</li>
    </ul>

    <p style="margin-top: 20px;">You can now log in to your dashboard and explore:</p>
    <p><a href="https://pay.iyonicorp.com/login" style="background-color: #4F46E5; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">🔐 Log In to IyonicPay</a></p>

    <p style="margin-top: 30px; font-size: 14px; color: #6B7280;">If you didn’t sign up for this account, you can safely ignore this email.</p>
    <p style="margin-top: 10px;">Welcome aboard!<br><strong>— The IyonicPay Team</strong></p>
  </div>
`
    });

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email }
    });

  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});
  // Add to your auth router
router.get('/check-name', async (req, res) => {
  const name = req.query.name;
  if (!name) return res.status(400).json({ msg: 'Name is required' });

  const exists = await User.findOne({ name: new RegExp(`^${name}$`, 'i') });
  return res.json({ exists: !!exists });
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    // Send login notification email
    sendEmail({
      to: email,
      subject: 'Login Notification - IyonicPay',
      html: `
        <p>Hello ${user.name},</p>
        <p>Your account was just logged in. If this wasn't you, please <a href="#">reset your password</a> immediately.</p>
        <p>Login Time: ${new Date().toLocaleString()}</p>
      `
    });

    res.json({ token, user: { id: user._id, name: user.name } });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        balance: user.balance || 0,
        transactions: user.transactions || [], // ✅ must include this
        spendToday: 0,                         // optional
        weeklyTransactions: (user.transactions || []).length
      }
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});

  

// @route POST /api/auth/request-reset
router.post('/request-reset', async (req, res) => {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'User not found' });
  
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit
    user.resetCode = code;
    user.resetCodeExpires = Date.now() + 15 * 60 * 1000; // valid for 15 minutes
    await user.save();
  
    sendEmail({
      to: email,
      subject: 'Password Reset Code - IyonicPay',
      html: `<p>Your reset code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`
    });
  
    res.json({ msg: 'Reset code sent to email' });
  });
  
// @route POST /api/auth/confirm-reset
router.post('/confirm-reset', async (req, res) => {
    const { email, code, newPassword } = req.body;
    const user = await User.findOne({ email });
  
    if (!user || user.resetCode !== code || Date.now() > user.resetCodeExpires) {
      return res.status(400).json({ msg: 'Invalid or expired code' });
    }
  
    const hash = await bcrypt.hash(newPassword, 10);
    user.password = hash;
    user.resetCode = undefined;
    user.resetCodeExpires = undefined;
    await user.save();
  
    // ✅ Send confirmation email
    sendEmail({
      to: email,
      subject: 'Your IyonicPay Password Has Been Reset',
      html: `
        <h2>Password Changed Successfully</h2>
        <p>Hello ${user.name},</p>
        <p>This is a confirmation that your password was recently updated.</p>
        <p>If you didn’t make this change, <a href="#">reset your password again</a> immediately or contact support.</p>
      `
    });
  
    res.json({ msg: 'Password has been reset. Please log in.' });
  });
  

  router.get('/user-by-email', authMiddleware, async (req, res) => {
    const { email } = req.query;
    if (!email) return res.status(400).json({ msg: 'Email required' });
  
    try {
      const user = await User.findOne({ email }).select('email name');
      if (!user) return res.status(404).json({ msg: 'User not found' });
  
      res.json({ user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ msg: 'Server error' });
    }
  });
  
  // routes/auth.js
router.post('/change-password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ msg: 'All fields required' });

  try {
    const user = await User.findById(req.user.id);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) return res.status(401).json({ msg: 'Current password incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Your Password Was Changed',
      html: `<p>Hello ${user.name},</p>
             <p>Your IyonicPay password was changed successfully.</p>
             <p>If you did not perform this action, please reset your password immediately.</p>`
    });

    res.json({ msg: 'Password updated and email sent.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
