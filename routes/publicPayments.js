const express = require('express');
const router = express.Router();
const { User, Transaction } = require('../models/User');
const sendEmail = require('../utils/sendEmail');

// @route   POST /api/public/pay/:userId

router.post('/pay/:userId', async (req, res) => {
  const { amount, reference, senderEmail } = req.body;
  const { userId } = req.params;

  if (!amount || amount <= 0 || !senderEmail) {
    return res.status(400).json({ msg: 'Invalid payment details' });
  }

  try {
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ msg: 'Recipient not found' });

    // Calculate fee (paid by payer) which will be awarded as credits to the merchant
    let feeEarned = 0;
    if (user.chargeFee && user.feePercentage > 0) {
      feeEarned = parseFloat(amount) * (parseFloat(user.feePercentage) / 100);
    }
    
    // Update user balance
    user.balance = parseFloat(user.balance || 0) + parseFloat(amount);
    user.credits = parseFloat(user.credits || 0) + feeEarned;

    // Record the transaction
    await Transaction.create({
      userId: user.id,
      type: 'receive',
      amount,
      status: 'completed',
      creditsEarned: feeEarned,
      description: feeEarned > 0 
        ? `Payment via public link (Earned $${feeEarned.toFixed(2)} credits)`
        : 'Payment via public link',
      from: senderEmail,
      reference,
      date: new Date()
    });

    await user.save();

    // Send email notification to recipient
    await sendEmail({
      to: user.email,
      subject: 'You Received a Payment',
      html: `
        <p>Hi ${user.name},</p>
        <p>You just received <strong>$${parseFloat(amount).toFixed(2)}</strong> from <strong>${senderEmail}</strong> via your payment link.</p>
        <p>Your new balance is <strong>$${parseFloat(user.balance).toFixed(2)}</strong>.</p>
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
