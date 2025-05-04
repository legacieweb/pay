const express = require('express');
const router = express.Router();
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail'); // ✅ You forgot this line

// GET /api/public/user-by-name?user=JohnDoe
router.get('/public/user-by-name', async (req, res) => {
  const username = req.query.user;
  if (!username) return res.status(400).json({ msg: 'Username required' });

  try {
    const users = await User.find();
    const match = users.find(u => u.name.replace(/\s+/g, '').toLowerCase() === username.toLowerCase());

    if (!match) return res.status(404).json({ msg: 'User not found' });

    res.json({
      id: match._id,         // ✅ Send user ID (but NOT in URL)
      name: match.name,
      email: match.email
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
});
router.post('/public/request-payment', async (req, res) => {
    const { userId, amount, reference, payerEmail } = req.body;
  
    if (!userId || !amount || !reference || !payerEmail) {
      return res.status(400).json({ msg: 'Missing required fields' });
    }
  
    try {
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ msg: 'User not found' });
  
      // Update balance and push transaction
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
  
      // Send notification to recipient (account owner)
      await sendEmail({
        to: user.email,
        subject: '✅ Payment Received',
        html: `
          <p>Hi ${user.name},</p>
          <p>You received <strong>$${amount.toFixed(2)}</strong> from ${payerEmail} via your IyonicPay request link.</p>
          <p>New balance: <strong>$${user.balance.toFixed(2)}</strong>.</p>
        `
      });
  
      // Send confirmation to payer
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
  
module.exports = router;
