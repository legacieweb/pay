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

router.post('/withdraw', authMiddleware, async (req, res) => {
  const { amount, method, country, accountDetails, saveAccount } = req.body;

  if (!amount || amount <= 0 || !method || !country || !accountDetails) {
    return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Calculate fee and total
    const fee = amount * 0.08;
    const totalDeducted = amount + fee;

    // Exchange rates per country
    const exchangeRates = {
      Nigeria: 1400,
      Kenya: 160,
      USA: 1,
      UK: 0.79
    };

    const rate = exchangeRates[country] || 1;
    const amountUserWillReceiveLocal = amount * rate;

    if (user.balance < totalDeducted) {
      return res.status(400).json({ msg: `Insufficient balance. Total needed is $${totalDeducted.toFixed(2)} including 8% fee.` });
    }

    // Save withdrawal details if needed
    if (saveAccount) {
      user.withdrawalDetails = { method, country, accountDetails };
    }

    // Deduct full amount including fee
    user.balance -= totalDeducted;

    user.transactions.push({
      type: 'withdraw',
      amount,
      fee,
      total: totalDeducted,
      status: 'pending',
      method,
      country,
      to: accountDetails,
      description: `Withdrawal via ${method} (${country}) - Fee: $${fee.toFixed(2)}`,
      date: new Date()
    });

    await user.save();

    // Email to user
    await sendEmail({
      to: user.email,
      subject: '🧾 Withdrawal Request Submitted',
      html: `
        <p>Hi ${user.name},</p>
        <p>Your withdrawal of <strong>$${amount.toFixed(2)}</strong> has been received.</p>
        <p><strong>Fee Charged:</strong> $${fee.toFixed(2)}<br/>
        <strong>Total Deducted:</strong> $${totalDeducted.toFixed(2)}</p>
        <p><strong>Method:</strong> ${method}<br/>
        <strong>Country:</strong> ${country}<br/>
        <strong>Account Info:</strong> ${accountDetails}</p>
        <p>Status: <strong>Pending</strong></p>
      `
    });

    // Email to admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: '⚠️ New Withdrawal Request with Fee',
      html: `
        <h3>New Withdrawal Alert</h3>
        <p><strong>User:</strong> ${user.name} (${user.email})</p>
        <p><strong>Requested Amount (USD):</strong> $${amount.toFixed(2)}</p>
        <p><strong>Fee Charged (8%):</strong> $${fee.toFixed(2)}</p>
        <p><strong>Total Deducted from Wallet:</strong> $${totalDeducted.toFixed(2)}</p>
        <p><strong>Expected Payout:</strong> ${amountUserWillReceiveLocal.toLocaleString()} in ${country} currency</p>
        <hr>
        <p><strong>Method:</strong> ${method}</p>
        <p><strong>Country:</strong> ${country}</p>
        <p><strong>Account Details:</strong> ${accountDetails}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      `
    });

    res.json({ msg: 'Withdrawal request submitted', fee, totalDeducted });

  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});


// === REFUND REQUEST ===
router.post('/refund-request-by-index/:index', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const index = parseInt(req.params.index);
    const { reason } = req.body;

    if (!user || isNaN(index) || !user.transactions[index]) {
      return res.status(400).json({ msg: 'Invalid transaction index' });
    }

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ msg: 'Please provide a valid reason (at least 5 characters).' });
    }

    const tx = user.transactions[index];
    const now = Date.now();
    const txTime = new Date(tx.date).getTime();
    const hoursSinceTx = (now - txTime) / (1000 * 60 * 60);

    if (tx.type !== 'send' || tx.status !== 'completed' || hoursSinceTx > 24) {
      return res.status(400).json({ msg: 'Only send transactions within 24 hours can be refunded.' });
    }

    tx.status = 'refund_requested';
    tx.refundReason = reason;
    await user.save();

    const receiver = await User.findOne({ email: tx.to });
    if (receiver) {
      const matchTx = receiver.transactions.find(t =>
        t.type === 'receive' &&
        t.amount === tx.amount &&
        t.from === user.email &&
        t.status === 'completed' &&
        Math.abs(new Date(t.date) - new Date(tx.date)) < 1000
      );

      if (matchTx) {
        matchTx.status = 'refund_requested';
        matchTx.refundReason = reason;
        await receiver.save();
      }
    }

    // === EMAIL NOTIFICATIONS ===
    await sendEmail({
      to: user.email,
      subject: '📨 Refund Requested',
      html: `
        <p>You requested a refund of <strong>$${tx.amount.toFixed(2)}</strong> to <strong>${tx.to}</strong>.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Date: ${new Date(tx.date).toLocaleString()}</p>
      `
    });

    if (receiver) {
      await sendEmail({
        to: receiver.email,
        subject: '⚠️ Refund Request Received',
        html: `
          <p><strong>${user.name}</strong> (${user.email}) has requested a refund of <strong>$${tx.amount.toFixed(2)}</strong>.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Please log in to approve or reject the refund.</p>
        `
      });
    }

    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: '⚠️ Refund Request Submitted',
      html: `
        <h3>Refund Request Alert</h3>
        <p><strong>From:</strong> ${user.name} (${user.email})</p>
        <p><strong>To:</strong> ${receiver ? `${receiver.name} (${receiver.email})` : 'Unknown'}</p>
        <p><strong>Amount:</strong> $${tx.amount.toFixed(2)}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Date:</strong> ${new Date(tx.date).toLocaleString()}</p>
      `
    });

    res.json({ msg: '✅ Refund request submitted successfully.' });

  } catch (err) {
    console.error('Refund Request Error:', err);
    res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
});

// === APPROVE REFUND ===
router.post('/approve-refund-by-index/:index', authMiddleware, async (req, res) => {
  try {
    const receiver = await User.findById(req.user.id);
    const index = parseInt(req.params.index);
    if (!receiver || isNaN(index) || !receiver.transactions[index]) {
      return res.status(400).json({ msg: 'Invalid transaction index' });
    }

    const recvTx = receiver.transactions[index];
    if (recvTx.type !== 'receive' || recvTx.status !== 'refund_requested') {
      return res.status(400).json({ msg: 'Not a valid refund request' });
    }

    const sender = await User.findOne({ email: recvTx.from });
    if (!sender) return res.status(404).json({ msg: 'Sender not found' });

    const sendTx = sender.transactions.find(t =>
      t.type === 'send' &&
      t.amount === recvTx.amount &&
      t.to === receiver.email &&
      t.status === 'refund_requested'
    );

    if (receiver.balance < recvTx.amount) {
      return res.status(400).json({ msg: 'Insufficient balance to issue refund' });
    }

    // Process refund
    receiver.balance -= recvTx.amount;
    sender.balance += recvTx.amount;
    recvTx.status = 'refunded';
    if (sendTx) sendTx.status = 'refunded';

    // Log new transactions
    sender.transactions.push({
      type: 'receive',
      amount: recvTx.amount,
      status: 'completed',
      description: 'Refund received',
      from: receiver.email,
      date: new Date()
    });

    receiver.transactions.push({
      type: 'send',
      amount: recvTx.amount,
      status: 'completed',
      description: 'Refund sent',
      to: sender.email,
      date: new Date()
    });

    await receiver.save();
    await sender.save();

    await sendEmail({ to: sender.email, subject: '✅ Refund Approved', html: `Refund of $${recvTx.amount} has been approved.` });
    await sendEmail({ to: receiver.email, subject: 'You Refunded a Payment', html: `You refunded $${recvTx.amount} to ${sender.email}` });
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: '✅ Refund Approved',
      html: `
        <h3>Refund Approved</h3>
        <p><strong>From:</strong> ${receiver.name} (${receiver.email})</p>
        <p><strong>To:</strong> ${sender.name} (${sender.email})</p>
        <p><strong>Amount:</strong> $${recvTx.amount.toFixed(2)}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Action:</strong> Refund Approved</p>
      `
    });
    
    res.json({ msg: 'Refund approved.' });
  } catch (err) {
    console.error('Approve Refund Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/reject-refund-by-index/:index', authMiddleware, async (req, res) => {
  try {
    const receiver = await User.findById(req.user.id);
    const index = parseInt(req.params.index);
    const { reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ msg: 'Reason for rejection is required.' });
    }

    const recvTx = receiver.transactions[index];
    if (!recvTx || recvTx.type !== 'receive' || recvTx.status !== 'refund_requested') {
      return res.status(404).json({ msg: 'Refund request not found or invalid' });
    }

    const sender = await User.findOne({ email: recvTx.from });
    if (!sender) return res.status(404).json({ msg: 'Sender not found' });

    const sendTx = sender.transactions.find(tx =>
      tx.to === receiver.email &&
      tx.amount === recvTx.amount &&
      tx.status === 'refund_requested'
    );

    recvTx.status = 'completed';
    if (sendTx) sendTx.status = 'completed';

    await receiver.save();
    await sender.save();

    // 📧 Emails with reason
    await sendEmail({
      to: sender.email,
      subject: '❌ Refund Rejected',
      html: `<p>Your refund request for <strong>$${recvTx.amount}</strong> was rejected by ${receiver.email}.</p>
             <p><strong>Reason:</strong> ${reason}</p>`
    });

    await sendEmail({
      to: receiver.email,
      subject: 'Refund Rejection Sent',
      html: `<p>You rejected the refund to ${sender.email} for <strong>$${recvTx.amount}</strong>.</p>
             <p><strong>Your reason:</strong> ${reason}</p>`
    });

    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: 'Refund Rejection Notice',
      html: `<p><strong>${receiver.email}</strong> rejected the refund request from <strong>${sender.email}</strong>.</p>
             <p>Amount: $${recvTx.amount}</p>
             <p><strong>Reason:</strong> ${reason}</p>`
    });

    res.json({ msg: 'Refund rejected.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;