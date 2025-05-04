const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// POST /api/wallet/deposit
router.post('/deposit', authMiddleware, async (req, res) => {
  const { amount, reference } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const user = await User.findById(req.user.id);
    user.balance += amount;

    user.transactions.push({
      type: 'deposit',
      amount,
      status: 'completed',
      description: 'Deposit via Paystack',
      reference,
      date: new Date()
    });

    await user.save();

    // ✅ Send deposit confirmation email
    await sendEmail({
      to: user.email,
      subject: '💰 Deposit Received',
      html: `<p>Hi ${user.name},</p>
             <p>Your deposit of <strong>$${amount.toFixed(2)}</strong> was successful.</p>
             <p>Your new balance is <strong>$${user.balance.toFixed(2)}</strong>.</p>
             <p>Ref: ${reference}</p>`
    });

    res.json({ msg: 'Deposit successful', balance: user.balance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST /api/wallet/send
router.post('/send', authMiddleware, async (req, res) => {
  const { toEmail, amount } = req.body;
  if (!toEmail || !amount || amount <= 0) {
    return res.status(400).json({ msg: 'Missing or invalid inputs' });
  }

  try {
    const sender = await User.findById(req.user.id);
    const receiver = await User.findOne({ email: toEmail });

    if (!receiver) return res.status(404).json({ msg: 'Recipient not found' });
    if (sender.balance < amount) return res.status(400).json({ msg: 'Insufficient balance' });

    // Update sender
    sender.balance -= amount;
    sender.transactions.push({
      type: 'send',
      amount,
      status: 'completed',
      description: `Sent to ${receiver.email}`,
      to: receiver.email,
      date: new Date()
    });

    await sender.save();

    // Update receiver
    receiver.balance += amount;
    receiver.transactions.push({
      type: 'receive',
      amount,
      status: 'completed',
      description: `Received from ${sender.email}`,
      from: sender.email,
      date: new Date()
    });

    await receiver.save();

    // ✅ Send email to sender
    await sendEmail({
      to: sender.email,
      subject: '💸 You Sent Money',
      html: `<p>Hi ${sender.name},</p>
             <p>You successfully sent <strong>$${amount.toFixed(2)}</strong> to ${receiver.email}.</p>
             <p>Your new balance is <strong>$${sender.balance.toFixed(2)}</strong>.</p>`
    });

    // ✅ Send email to receiver
    await sendEmail({
      to: receiver.email,
      subject: '💰 You Received Money',
      html: `<p>Hi ${receiver.name},</p>
             <p>You received <strong>$${amount.toFixed(2)}</strong> from ${sender.email}.</p>
             <p>Your new balance is <strong>$${receiver.balance.toFixed(2)}</strong>.</p>`
    });

    res.json({ msg: 'Transfer successful' });
  } catch (err) {
    console.error('Transfer error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
