const express = require('express');
const router = express.Router();
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @route   POST /api/public/pay/:userId
// @desc    Accept payment to a user via shared link
// @access  Public
router.post('/pay/:userId', async (req, res) => {
  const { amount, reference, senderEmail } = req.body;
  const { userId } = req.params;

  if (!amount || amount <= 0 || !senderEmail) {
    return res.status(400).json({ msg: 'Invalid payment details' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'Recipient not found' });

    // Record the transaction
    user.balance += amount;
    user.transactions.push({
      type: 'receive',
      amount,
      status: 'completed',
      description: `Payment via public link`,
      from: senderEmail,
      reference,
      date: new Date()
    });

    await user.save();

    // Send email notification to recipient
    await sendEmail({
      to: user.email,
      subject: '💰 You Received a Payment',
      html: `
        <p>Hi ${user.name},</p>
        <p>You just received <strong>$${amount.toFixed(2)}</strong> from <strong>${senderEmail}</strong> via your payment link.</p>
        <p>Your new balance is <strong>$${user.balance.toFixed(2)}</strong>.</p>
        <p>Ref: ${reference}</p>
      `
    });

    res.status(200).json({ msg: 'Payment processed and recorded successfully.' });

  } catch (err) {
    console.error('Payment link error:', err.message);
    res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
});

module.exports = router;
