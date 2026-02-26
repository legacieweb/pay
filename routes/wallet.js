const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const wiseCurrencyData = {
  AED: { name: 'United Arab Emirates Dirham', rate: 3.67 },
  ARS: { name: 'Argentine Peso', rate: 900 },
  AUD: { name: 'Australian Dollar', rate: 1.52 },
  BDT: { name: 'Bangladeshi Taka', rate: 110 },
  BGN: { name: 'Bulgarian Lev', rate: 1.77 },
  BRL: { name: 'Brazilian Real', rate: 5.45 },
  CAD: { name: 'Canadian Dollar', rate: 1.36 },
  CHF: { name: 'Swiss Franc', rate: 0.9 },
  CLP: { name: 'Chilean Peso', rate: 920 },
  CNY: { name: 'Chinese Yuan', rate: 7.2 },
  COP: { name: 'Colombian Peso', rate: 3900 },
  CRC: { name: 'Costa Rican Colón', rate: 515 },
  CZK: { name: 'Czech Koruna', rate: 23.4 },
  DKK: { name: 'Danish Krone', rate: 6.85 },
  EGP: { name: 'Egyptian Pound', rate: 48 },
  EUR: { name: 'Euro', rate: 0.8471 },
  GBP: { name: 'British Pound', rate: 0.7378 },
  GEL: { name: 'Georgian Lari', rate: 2.8 },
  HKD: { name: 'Hong Kong Dollar', rate: 7.8 },
  HUF: { name: 'Hungarian Forint', rate: 365 },
  IDR: { name: 'Indonesian Rupiah', rate: 15600 },
  ILS: { name: 'Israeli Shekel', rate: 3.75 },
  INR: { name: 'Indian Rupee', rate: 84 },
  JPY: { name: 'Japanese Yen', rate: 151 },
  KES: { name: 'Kenyan Shilling', rate: 129.00 },
  KRW: { name: 'South Korean Won', rate: 1350 },
  LKR: { name: 'Sri Lankan Rupee', rate: 305 },
  MAD: { name: 'Moroccan Dirham', rate: 10.1 },
  MXN: { name: 'Mexican Peso', rate: 18.2 },
  MYR: { name: 'Malaysian Ringgit', rate: 4.7 },
  NGN: { name: 'Nigerian Naira', rate: 1400 },
  NOK: { name: 'Norwegian Krone', rate: 10.7 },
  NPR: { name: 'Nepalese Rupee', rate: 134 },
  NZD: { name: 'New Zealand Dollar', rate: 1.7 },
  PEN: { name: 'Peruvian Sol', rate: 3.8 },
  PHP: { name: 'Philippine Peso', rate: 56 },
  PKR: { name: 'Pakistani Rupee', rate: 278 },
  PLN: { name: 'Polish Złoty', rate: 4.1 },
  RON: { name: 'Romanian Leu', rate: 4.6 },
  SEK: { name: 'Swedish Krona', rate: 10.8 },
  SGD: { name: 'Singapore Dollar', rate: 1.35 },
  THB: { name: 'Thai Baht', rate: 37 },
  TRY: { name: 'Turkish Lira', rate: 34 },
  TZS: { name: 'Tanzanian Shilling', rate: 2500 },
  UAH: { name: 'Ukrainian Hryvnia', rate: 40 },
  UGX: { name: 'Ugandan Shilling', rate: 3800 },
  USD: { name: 'US Dollar', rate: 1 },
  UYU: { name: 'Uruguayan Peso', rate: 42 },
  VND: { name: 'Vietnamese Dong', rate: 24800 },
  ZAR: { name: 'South African Rand', rate: 18.5 }
};

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
  const { amount, method, country, currency, accountDetails, payoutDetails, saveAccount } = req.body;

  if (!amount || amount <= 0 || !method) {
    return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
  }

  const rawCurrencyInput = ((currency || country || '') + '').trim();
  if (!rawCurrencyInput) {
    return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
  }

  const normalizedMethod = method.toString().trim();
  if (!normalizedMethod) {
    return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
  }

  let structuredDetails = null;
  let formattedAccountDetails = '';

  const detailsToUse = payoutDetails || accountDetails;
  if (!detailsToUse) {
    return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
  }

  if (typeof detailsToUse === 'object' && detailsToUse !== null) {
    structuredDetails = {};
    for (const [key, value] of Object.entries(detailsToUse)) {
      const detailKey = key.toString().trim();
      const detailValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
      if (!detailKey || !detailValue) {
        return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
      }
      structuredDetails[detailKey] = detailValue;
    }
    if (!Object.keys(structuredDetails).length) {
      return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
    }
    formattedAccountDetails = Object.entries(structuredDetails).map(([k, v]) => `${k}: ${v}`).join(', ');
  } else {
    const trimmedDetails = detailsToUse.toString().trim();
    if (!trimmedDetails) {
      return res.status(400).json({ msg: 'Please provide all withdrawal details.' });
    }
    formattedAccountDetails = trimmedDetails;
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const feeRate = 0.05;
    const totalFee = amount * feeRate;
    
    let creditsUsed = 0;
    let remainingFee = totalFee;

    if (user.credits > 0) {
      if (user.credits >= totalFee) {
        creditsUsed = totalFee;
        remainingFee = 0;
      } else {
        creditsUsed = user.credits;
        remainingFee = totalFee - user.credits;
      }
    }

    // Amount deducted from balance is the full requested amount
    const totalDeducted = amount;
    // Amount the user actually gets after remaining fee is deducted
    const amountToReceive = amount - remainingFee;

    const rawCurrency = rawCurrencyInput;
    let currencyCode = rawCurrency.toUpperCase();
    let currencyInfo = wiseCurrencyData[currencyCode];

    if (!currencyInfo) {
      const matched = Object.entries(wiseCurrencyData).find(([, data]) => data.name.toLowerCase() === rawCurrency.toLowerCase());
      if (matched) {
        currencyCode = matched[0];
        currencyInfo = matched[1];
      }
    }

    if (!currencyInfo) {
      currencyInfo = { name: rawCurrency, rate: 1 };
    }

    const rate = currencyInfo.rate || 1;
    const amountUserWillReceiveLocal = amountToReceive * rate;
    const currencyDisplay = currencyInfo.name && currencyInfo.name !== currencyCode
      ? `${currencyInfo.name} (${currencyCode})`
      : currencyCode;

    if (user.balance < totalDeducted) {
      return res.status(400).json({ msg: `Insufficient balance. You need $${totalDeducted.toFixed(2)} in your balance.` });
    }

    if (saveAccount) {
      user.withdrawalDetails = { method: normalizedMethod, country: currencyCode, accountDetails: structuredDetails || { details: formattedAccountDetails } };
    }

    user.balance -= totalDeducted;
    user.credits -= creditsUsed;

    user.transactions.push({
      type: 'withdraw',
      amount: amountToReceive,
      fee: totalFee,
      creditsUsed,
      remainingFee,
      total: totalDeducted,
      status: 'pending',
      method: normalizedMethod,
      country: currencyCode,
      to: formattedAccountDetails,
      description: `Withdrawal via ${normalizedMethod} (${currencyInfo.name || currencyCode}) - Fee: $${totalFee.toFixed(2)} (Used $${creditsUsed.toFixed(2)} credits)`,
      expectedPayoutEtaHours: 12,
      date: new Date()
    });

    await user.save();

    await sendEmail({
      to: user.email,
      subject: '🧾 Withdrawal Request Submitted',
      html: `
        <p>Hi ${user.name},</p>
        <p>Your withdrawal of <strong>$${amountToReceive.toFixed(2)}</strong> (after fees) has been received.</p>
        <p><strong>Total Fee (5%):</strong> $${totalFee.toFixed(2)}<br/>
        <strong>Credits Used:</strong> $${creditsUsed.toFixed(2)}<br/>
        <strong>Remaining Fee Deducted:</strong> $${remainingFee.toFixed(2)}</p>
        <p><strong>Total Balance Deducted:</strong> $${totalDeducted.toFixed(2)}</p>
        <p><strong>Method:</strong> ${normalizedMethod}<br/>
        <strong>Currency:</strong> ${currencyDisplay}<br/>
        <strong>Account Info:</strong> ${formattedAccountDetails}</p>
        <p>Status: <strong>Processing</strong></p>
        <p>We guarantee your payout will be completed in under 12 hours.</p>
      `
    });

    await sendEmail({
      to: 'iyonicpay@gmail.com',
      subject: '⚠️ New Withdrawal Request (5% Fee)',
      html: `
        <h3>New Withdrawal Alert</h3>
        <p><strong>User:</strong> ${user.name} (${user.email})</p>
        <p><strong>Gross Requested Amount (USD):</strong> $${amount.toFixed(2)}</p>
        <p><strong>Total Fee (5%):</strong> $${totalFee.toFixed(2)}</p>
        <p><strong>Credits Used:</strong> $${creditsUsed.toFixed(2)}</p>
        <p><strong>Remaining Fee Deducted:</strong> $${remainingFee.toFixed(2)}</p>
        <p><strong>Net Amount to Send (USD):</strong> $${amountToReceive.toFixed(2)}</p>
        <p><strong>Expected Payout:</strong> ${amountUserWillReceiveLocal.toLocaleString()} ${currencyDisplay}</p>
        <p><strong>Payout Guarantee:</strong> Under 12 hours</p>
        <hr>
        <p><strong>Method:</strong> ${normalizedMethod}</p>
        <p><strong>Currency:</strong> ${currencyDisplay}</p>
        <p><strong>Account Details:</strong> ${formattedAccountDetails}</p>
        <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
      `
    });

    res.json({ 
      msg: 'Withdrawal request submitted', 
      fee: totalFee, 
      creditsUsed, 
      remainingFee, 
      totalDeducted, 
      amountToReceive,
      payoutEtaHours: 12, 
      currency: currencyCode, 
      currencyName: currencyInfo.name, 
      accountDetails: structuredDetails || { details: formattedAccountDetails } 
    });

  } catch (err) {
    console.error('Withdraw error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/withdrawal-details', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('withdrawalDetails');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ withdrawalDetails: user.withdrawalDetails || null });
  } catch (err) {
    console.error('Fetch withdrawal details error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/withdrawal-details', authMiddleware, async (req, res) => {
  try {
    const { currency: currencyInput, method, details } = req.body;
    const normalizedCurrency = ((currencyInput || '') + '').trim().toUpperCase();
    const normalizedMethod = ((method || '') + '').trim();

    if (!normalizedCurrency || !normalizedMethod || !details || typeof details !== 'object') {
      return res.status(400).json({ msg: 'Please provide all payout details.' });
    }

    const sanitizedDetails = {};
    for (const [key, value] of Object.entries(details)) {
      const detailKey = key.toString().trim();
      const detailValue = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
      if (!detailKey || !detailValue) {
        return res.status(400).json({ msg: 'Please provide all payout details.' });
      }
      sanitizedDetails[detailKey] = detailValue;
    }

    if (!Object.keys(sanitizedDetails).length) {
      return res.status(400).json({ msg: 'Please provide all payout details.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.withdrawalDetails = { method: normalizedMethod, country: normalizedCurrency, accountDetails: sanitizedDetails };
    await user.save();

    res.json({ msg: 'Saved payout details', withdrawalDetails: user.withdrawalDetails });
  } catch (err) {
    console.error('Save withdrawal details error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/save-payout-details', authMiddleware, async (req, res) => {
  try {
    const { method, currency, payoutDetails } = req.body;
    
    if (!method || !currency || !payoutDetails || typeof payoutDetails !== 'object') {
      return res.status(400).json({ msg: 'Please provide all payout details.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.payoutDetails = { method, currency, payoutDetails };
    await user.save();

    res.json({ msg: 'Payout details saved successfully', payoutDetails: user.payoutDetails });
  } catch (err) {
    console.error('Save payout details error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/payout-details', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('payoutDetails');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ payoutDetails: user.payoutDetails || null });
  } catch (err) {
    console.error('Fetch payout details error:', err);
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

// === SAVINGS / EARNING ===
router.post('/savings/deposit', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const user = await User.findById(req.user.id);
    if (user.balance < amount) return res.status(400).json({ msg: 'Insufficient balance' });

    user.balance -= amount;
    user.savingsBalance += amount;

    user.transactions.push({
      type: 'send',
      amount,
      status: 'completed',
      description: 'Transfer to Savings (Earning)',
      date: new Date()
    });

    await user.save();
    res.json({ msg: 'Successfully deposited to savings', balance: user.balance, savingsBalance: user.savingsBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/savings/withdraw', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const user = await User.findById(req.user.id);
    if (user.savingsBalance < amount) return res.status(400).json({ msg: 'Insufficient savings balance' });

    user.savingsBalance -= amount;
    user.balance += amount;

    user.transactions.push({
      type: 'receive',
      amount,
      status: 'completed',
      description: 'Transfer from Savings (Earning)',
      date: new Date()
    });

    await user.save();
    res.json({ msg: 'Successfully withdrawn from savings', balance: user.balance, savingsBalance: user.savingsBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;
