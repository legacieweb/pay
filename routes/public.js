const express = require('express');
const router = express.Router();
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const DefaultAmount = require('../models/DefaultAmount'); // ✅ REQUIRED
const authMiddleware = require('../middleware/authMiddleware');

// ==============================
// GET /api/public/user-by-username
// ==============================
router.get('/user-by-username', async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ msg: 'Username required' });

  try {
    const users = await User.find();
    const match = users.find(u =>
      u.name.replace(/\s+/g, '').toLowerCase() === username.toLowerCase()
    );

    if (!match) return res.status(404).json({ msg: 'User not found' });

    const config = await DefaultAmount.findOne({ userId: match._id });

    res.json({
      user: {
        id: match._id,
        name: match.name,
        email: match.email,
        defaultAmount: config ? config.amount : null,
        chargeFee: match.chargeFee,
        feePercentage: match.feePercentage,
        paystackPublicKey: match.paystackPublicKey || process.env.PAYSTACK_PUBLIC_KEY
      }
    });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==================================
// POST /api/public/request-payment
// ==================================
router.post('/request-payment', async (req, res) => {
  let { userId, amount, reference, payerEmail, payerName } = req.body;

  if (!userId || !amount || !reference || !payerEmail) {
    return res.status(400).json({ msg: 'Missing required fields' });
  }

  // Ensure amount is a number
  amount = parseFloat(amount);

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Calculate fee (paid by payer) which will be awarded as credits to the merchant
    let feeEarned = 0;
    if (user.chargeFee && user.feePercentage > 0) {
      feeEarned = amount * (user.feePercentage / 100);
    }

    user.balance += amount;
    user.credits += feeEarned;

    user.transactions.push({
      type: 'requested',
      amount,
      reference,
      creditsEarned: feeEarned,
      description: feeEarned > 0 
        ? `Received via public request payment (Earned $${feeEarned.toFixed(2)} credits)`
        : 'Received via public request payment',
      customerEmail: payerEmail,
      customerName: payerName,
      status: 'completed',
      date: new Date()
    });

    await user.save();

    // Notify user
    await sendEmail({
      to: user.email,
      subject: 'Payment Received - IyonicPay',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2 style="color: #4f46e5;">Payment Received!</h2>
          <p>Hi ${user.name},</p>
          <p>You have received a payment of <strong>$${amount.toFixed(2)}</strong> from <strong>${payerName || payerEmail}</strong>.</p>
          <p>Transaction Reference: <code>${reference}</code></p>
          <p>Your new balance is <strong>$${user.balance.toFixed(2)}</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">This is an automated notification from IyonicPay.</p>
        </div>
      `
    });

    // Confirm payer
    await sendEmail({
      to: payerEmail,
      subject: 'Payment Confirmation - IyonicPay',
      html: `
        <div style="font-family: sans-serif; color: #333;">
          <h2 style="color: #4f46e5;">Payment Successful</h2>
          <p>Hello ${payerName || 'there'},</p>
          <p>Your payment of <strong>$${amount.toFixed(2)}</strong> to <strong>${user.name}</strong> was successful.</p>
          <p>Transaction Reference: <code>${reference}</code></p>
          <p>Thank you for using IyonicPay!</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">IyonicPay - Seamless Global Payments</p>
        </div>
      `
    });

    res.json({ msg: 'Payment recorded and emails sent' });

  } catch (err) {
    console.error('Payment error:', err.message);
    res.status(500).json({ msg: 'Server error during payment' });
  }
});


// ================================
// GET /api/public/default-amount/:userId
// ================================
router.get('/default-amount/:userId', async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ msg: 'Missing userId' });

  try {
    const config = await DefaultAmount.findOne({ userId });
    // If no config found, return 0 instead of 404 to avoid frontend errors
    if (!config) return res.status(200).json({ amount: 0 });

    res.status(200).json({ amount: config.amount });
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

  if (!userId) {
    return res.status(400).json({ error: '❌ userId required' });
  }

  // Allow null to clear the default amount
  if (amount !== null && (typeof amount !== 'number' || amount < 0)) {
    return res.status(400).json({ error: '❌ Invalid input: amount must be a number ≥ 0 or null' });
  }

  if (req.user?.id !== userId) {
    return res.status(403).json({ error: '❌ Unauthorized: Cannot modify another user' });
  }

  try {
    // If it's a separate model "DefaultAmount"
    if (amount === null) {
      await DefaultAmount.findOneAndDelete({ userId });
    } else {
      await DefaultAmount.findOneAndUpdate(
        { userId },
        { amount },
        { upsert: true, new: true }
      );
    }

    // Also update User model if redundant or if that's where we read it from?
    // User model has "defaultAmount" as well. Let's keep them in sync or check which one we use.
    // In "user-by-username" we use the config from DefaultAmount.
    // But we also have "defaultAmount" in User model?
    // Let's update both just in case.
    await User.findByIdAndUpdate(userId, { defaultAmount: amount });

    res.json({
      msg: amount === null
        ? '✅ Default amount cleared'
        : '✅ Default amount saved',
      defaultAmount: amount
    });
  } catch (err) {
    console.error('❌ Error updating default amount:', err);
    res.status(500).json({ error: '❌ Server error. Try again later.' });
  }
});



// ===================================
// POST /api/public/user/fee-settings (protected)
// ===================================
router.post('/user/fee-settings', authMiddleware, async (req, res) => {
  const { userId, chargeFee, feePercentage } = req.body;

  if (!userId || chargeFee === undefined || feePercentage === undefined) {
    return res.status(400).json({ error: '❌ Missing required fields' });
  }

  if (req.user?.id !== userId) {
    return res.status(403).json({ error: '❌ Unauthorized' });
  }

  if (feePercentage < 0 || feePercentage > 5) {
    return res.status(400).json({ error: '❌ Fee percentage must be between 0 and 5%' });
  }

  try {
    await User.findByIdAndUpdate(userId, { chargeFee, feePercentage });
    res.json({ msg: '✅ Fee settings updated successfully' });
  } catch (err) {
    console.error('❌ Error updating fee settings:', err);
    res.status(500).json({ error: '❌ Server error' });
  }
});

module.exports = router;
