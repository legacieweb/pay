const express = require('express');
const router = express.Router();
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const DefaultAmount = require('../models/DefaultAmount'); // ✅ REQUIRED
const authMiddleware = require('../middleware/authMiddleware');

// ==============================
// GET /api/public/user-by-name
// ==============================
router.get('/public/user-by-name', async (req, res) => {
  const username = req.query.user;
  if (!username) return res.status(400).json({ msg: 'Username required' });

  try {
    const users = await User.find();
    const match = users.find(u =>
      u.name.replace(/\s+/g, '').toLowerCase() === username.toLowerCase()
    );

    if (!match) return res.status(404).json({ msg: 'User not found' });

    res.json({
      id: match._id,
      name: match.name,
      email: match.email
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==================================
// POST /api/public/request-payment
// ==================================
router.post('/public/request-payment', async (req, res) => {
  const { userId, amount, reference, payerEmail } = req.body;

  if (!userId || !amount || !reference || !payerEmail) {
    return res.status(400).json({ msg: 'Missing required fields' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.balance += amount;
    user.transactions.push({
      type: 'requested',
      amount,
      reference,
      description: 'Received via public Paystack payment',
      customerEmail: payerEmail,
      status: 'completed',
      date: new Date()
    });

    await user.save();

    // Notify user
    await sendEmail({
      to: user.email,
      subject: 'Payment Received',
      html: `
        <p>Hi ${user.name},</p>
        <p>You received <strong>$${amount.toFixed(2)}</strong> from ${payerEmail} via your IyonicPay request link.</p>
        <p>New balance: <strong>$${user.balance.toFixed(2)}</strong>.</p>
      `
    });

    // Confirm payer
    await sendEmail({
      to: payerEmail,
      subject: 'Payment Confirmation - IyonicPay',
      html: `
        <p>Hello,</p>
        <p>Your payment of <strong>$${amount.toFixed(2)}</strong> to ${user.name} was successful.</p>
        <p>Thank you for using IyonicPay!</p>
      `
    });

    res.json({ msg: 'Payment recorded and emails sent' });

  } catch (err) {
    console.error('Payment error:', err.message);
    res.status(500).json({ msg: 'Server error during payment' });
  }
});


// ================================
// GET /api/public/default-amount
// ================================
router.get('/public/default-amount', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ msg: 'Missing userId' });

  try {
    const config = await DefaultAmount.findOne({ userId });
    if (!config) return res.status(404).json({ msg: 'No default found' });

    res.status(200).json({ defaultAmount: config.amount });
  } catch (err) {
    console.error('Error loading default amount:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});
// ===================================
// POST /api/user/default-amount (protected)
// ===================================
router.post('/user/default-amount', authMiddleware, async (req, res) => {
  const { userId, amount } = req.body;

  if (!userId || amount == null || typeof amount !== 'number' || amount < 0) {
    return res.status(400).json({ error: '❌ Invalid input: userId and amount ≥ 0 required' });
  }

  if (req.user?.id !== userId) {
    return res.status(403).json({ error: '❌ Unauthorized: Cannot modify another user' });
  }

  try {
    await DefaultAmount.findOneAndUpdate(
      { userId },
      { amount },
      { upsert: true, new: true }
    );

    res.json({
      msg: amount === 0
        ? '✅ Default amount set to 0 (payer can enter any amount)'
        : '✅ Default amount saved',
      defaultAmount: amount
    });
  } catch (err) {
    console.error('❌ Error updating default amount:', err);
    res.status(500).json({ error: '❌ Server error. Try again later.' });
  }
});



module.exports = router;
