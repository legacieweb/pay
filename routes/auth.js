const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();

// @route   POST /api/auth/signup
router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    try {
      let user = await User.findOne({ email });
      if (user) return res.status(400).json({ msg: 'User already exists' });
  
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(password, salt);
  
      user = new User({ name, email, password: hash });
      await user.save();
  
      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  
      // ✅ Send welcome email
      await sendEmail({
        to: email,
        subject: '🎉 Welcome to IyonicPay!',
        html: `
          <h2>Hello, ${name}!</h2>
          <p>Welcome to <strong>IyonicPay</strong>. Your account has been successfully created.</p>
          <p>You can now log in and start sending, receiving, and managing your money easily.</p>
          <p style="margin-top:20px">Regards,<br/>IyonicPay Team</p>
        `
      });
  
      // ✅ Return user data
      res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
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
      subject: '🔐 Login Notification - IyonicPay',
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
      subject: '🔑 Password Reset Code - IyonicPay',
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
      subject: '✅ Your IyonicPay Password Has Been Reset',
      html: `
        <h2>Password Changed Successfully</h2>
        <p>Hello ${user.name},</p>
        <p>This is a confirmation that your password was recently updated.</p>
        <p>If you didn’t make this change, <a href="#">reset your password again</a> immediately or contact support.</p>
      `
    });
  
    res.json({ msg: 'Password has been reset. Please log in.' });
  });
  

  
module.exports = router;
