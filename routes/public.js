const express = require('express');
const router = express.Router();
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
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
      subject: '✅ Payment Received',
      html: `
        <p>Hi ${user.name},</p>
        <p>You received <strong>$${amount.toFixed(2)}</strong> from ${payerEmail} via your IyonicPay request link.</p>
        <p>New balance: <strong>$${user.balance.toFixed(2)}</strong>.</p>
      `
    });

    // Confirm payer
    await sendEmail({
      to: payerEmail,
      subject: '💸 Payment Confirmation - IyonicPay',
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

  if (!userId) {
    return res.status(400).json({ error: '❌ Missing userId in query' });
  }

  try {
    const user = await User.findById(userId).select('defaultAmount');
    if (!user) {
      return res.status(404).json({ error: '❌ User not found' });
    }

    // Return the defaultAmount (if not set, treat as 0 = unlock)
    res.json({ defaultAmount: user.defaultAmount ?? 0 });
  } catch (err) {
    console.error('❌ Error fetching default amount:', err);
    res.status(500).json({ error: '❌ Server error. Please try again later.' });
  }
});


// ===================================
// POST /api/user/default-amount (protected)
// ===================================
router.post('/user/default-amount', authMiddleware, async (req, res) => {
  const { userId, amount } = req.body;

  // Basic validation
  if (!userId || amount == null) {
    return res.status(400).json({ error: '❌ Missing userId or amount' });
  }

  if (typeof amount !== 'number' || isNaN(amount) || amount < 0) {
    return res.status(400).json({ error: '❌ Invalid amount. Must be a number ≥ 0' });
  }

  try {
    // Ensure the user updating matches the token user
    if (req.user?.id !== userId) {
      return res.status(403).json({ error: '❌ Unauthorized: Cannot update another user' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: '❌ User not found' });
    }

    user.defaultAmount = amount;
    await user.save();

    res.json({
      msg: amount === 0 
        ? '✅ Default amount set to 0 (payer can enter any amount)'
        : '✅ Default amount updated successfully',
      defaultAmount: user.defaultAmount
    });
  } catch (err) {
    console.error('❌ Error updating default amount:', err);
    res.status(500).json({ error: '❌ Server error. Please try again later.' });
  }
});


module.exports = router;
