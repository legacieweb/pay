const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { User, Transaction } = require('../models/User');
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
    const user = await User.findByPk(req.user.id);
    user.balance = parseFloat(user.balance || 0) + parseFloat(amount);

    await Transaction.create({
      userId: user.id,
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
             <p>Your deposit of <strong>$${parseFloat(amount || 0).toFixed(2)}</strong> was successful.</p>
             <p>Your new balance is <strong>$${parseFloat(user.balance || 0).toFixed(2)}</strong>.</p>
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
    return res.status(400).json({ msg: 'Email and amount are required' });
  }

  try {
    const sender = await User.findByPk(req.user.id);
    const receiver = await User.findOne({ where: { email: toEmail } });

    if (!receiver) return res.status(404).json({ msg: 'Recipient not found' });
    if (parseFloat(sender.balance) < parseFloat(amount)) return res.status(400).json({ msg: 'Insufficient balance' });

    // Update sender
    sender.balance = parseFloat(sender.balance) - parseFloat(amount);
    
    await Transaction.create({
      userId: sender.id,
      type: 'send',
      amount,
      status: 'completed',
      description: `Sent to ${receiver.email}`,
      to: receiver.email,
      date: new Date()
    });

    await sender.save();

    // Update receiver
    receiver.balance = parseFloat(receiver.balance) + parseFloat(amount);
    
    await Transaction.create({
      userId: receiver.id,
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
             <p>You successfully sent <strong>$${parseFloat(amount || 0).toFixed(2)}</strong> to ${receiver.email}.</p>
             <p>Your new balance is <strong>$${parseFloat(sender.balance || 0).toFixed(2)}</strong>.</p>`
    });

    // ✅ Send email to receiver
    await sendEmail({
      to: receiver.email,
      subject: '💰 You Received Money',
      html: `<p>Hi ${receiver.name},</p>
             <p>You received <strong>$${parseFloat(amount || 0).toFixed(2)}</strong> from ${sender.email}.</p>
             <p>Your new balance is <strong>$${parseFloat(receiver.balance || 0).toFixed(2)}</strong>.</p>`
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
    const user = await User.findByPk(req.user.id);
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
      return res.status(400).json({ msg: `Insufficient balance. You need $${parseFloat(totalDeducted || 0).toFixed(2)} in your balance.` });
    }

    if (saveAccount) {
      user.withdrawalMethod = normalizedMethod;
      user.withdrawalMethodLabel = normalizedMethod;
      user.withdrawalCountry = currencyCode;
      user.withdrawalAccountDetails = structuredDetails || { details: formattedAccountDetails };
    }

    user.balance = parseFloat(user.balance) - parseFloat(totalDeducted);
    user.credits = parseFloat(user.credits) - parseFloat(creditsUsed);

    await Transaction.create({
      userId: user.id,
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
      description: `Withdrawal via ${normalizedMethod} (${currencyInfo.name || currencyCode}) - Fee: $${parseFloat(totalFee || 0).toFixed(2)} (Used $${parseFloat(creditsUsed || 0).toFixed(2)} credits)`,
      date: new Date()
    });

    await user.save();

    await sendEmail({
      to: user.email,
      subject: '🧾 Withdrawal Request Submitted',
      html: `
        <p>Hi ${user.name},</p>
        <p>Your withdrawal of <strong>$${parseFloat(amountToReceive || 0).toFixed(2)}</strong> (after fees) has been received.</p>
        <p><strong>Total Fee (5%):</strong> $${parseFloat(totalFee || 0).toFixed(2)}<br/>
        <strong>Credits Used:</strong> $${parseFloat(creditsUsed || 0).toFixed(2)}<br/>
        <strong>Remaining Fee Deducted:</strong> $${parseFloat(remainingFee || 0).toFixed(2)}</p>
        <p><strong>Total Balance Deducted:</strong> $${parseFloat(totalDeducted || 0).toFixed(2)}</p>
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
        <p><strong>Gross Requested Amount (USD):</strong> $${parseFloat(amount || 0).toFixed(2)}</p>
        <p><strong>Total Fee (5%):</strong> $${parseFloat(totalFee || 0).toFixed(2)}</p>
        <p><strong>Credits Used:</strong> $${parseFloat(creditsUsed || 0).toFixed(2)}</p>
        <p><strong>Remaining Fee Deducted:</strong> $${parseFloat(remainingFee || 0).toFixed(2)}</p>
        <p><strong>Net Amount to Send (USD):</strong> $${parseFloat(amountToReceive || 0).toFixed(2)}</p>
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
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ withdrawalDetails: {
      method: user.withdrawalMethod,
      methodLabel: user.withdrawalMethodLabel,
      country: user.withdrawalCountry,
      accountDetails: user.withdrawalAccountDetails
    } });
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

    const user = await User.findByPk(req.user.id);
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

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    user.payoutMethod = method;
    user.payoutCurrency = currency;
    user.payoutDetails = payoutDetails;
    await user.save();

    res.json({ msg: 'Payout details saved successfully', payoutDetails: { method: user.payoutMethod, currency: user.payoutCurrency, payoutDetails: user.payoutDetails } });
  } catch (err) {
    console.error('Save payout details error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.get('/payout-details', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ payoutDetails: {
      method: user.payoutMethod,
      currency: user.payoutCurrency,
      payoutDetails: user.payoutDetails
    } });
  } catch (err) {
    console.error('Fetch payout details error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// === REFUND REQUEST ===
router.post('/refund-request/:txId', authMiddleware, async (req, res) => {
  try {
    const { txId } = req.params;
    const { reason } = req.body;

    const tx = await Transaction.findOne({
      where: { id: txId, userId: req.user.id }
    });

    if (!tx) {
      return res.status(404).json({ msg: 'Transaction not found' });
    }

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ msg: 'Please provide a valid reason (at least 5 characters).' });
    }

    const now = Date.now();
    const txTime = new Date(tx.date).getTime();
    const hoursSinceTx = (now - txTime) / (1000 * 60 * 60);

    if (tx.type !== 'send' || tx.status !== 'completed' || hoursSinceTx > 24) {
      return res.status(400).json({ msg: 'Only send transactions within 24 hours can be refunded.' });
    }

    tx.status = 'refund_requested';
    tx.refundReason = reason;
    await tx.save();

    const receiver = await User.findOne({ where: { email: tx.to } });
    if (receiver) {
      const matchTx = await Transaction.findOne({
        where: {
          userId: receiver.id,
          type: 'receive',
          amount: tx.amount,
          from: req.user.email,
          status: 'completed'
        }
      });

      if (matchTx) {
        matchTx.status = 'refund_requested';
        matchTx.refundReason = reason;
        await matchTx.save();
      }
    }

    // === EMAIL NOTIFICATIONS ===
    await sendEmail({
      to: req.user.email,
      subject: '📨 Refund Requested',
      html: `
        <p>You requested a refund of <strong>$${parseFloat(tx.amount).toFixed(2)}</strong> to <strong>${tx.to}</strong>.</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p>Date: ${new Date(tx.date).toLocaleString()}</p>
      `
    });

    if (receiver) {
      await sendEmail({
        to: receiver.email,
        subject: '⚠️ Refund Request Received',
        html: `
          <p><strong>${req.user.name}</strong> (${req.user.email}) has requested a refund of <strong>$${parseFloat(tx.amount).toFixed(2)}</strong>.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Please log in to approve or reject the refund.</p>
        `
      });
    }

    res.json({ msg: '✅ Refund request submitted successfully.' });

  } catch (err) {
    console.error('Refund Request Error:', err);
    res.status(500).json({ msg: 'Server error. Please try again later.' });
  }
});

// === APPROVE REFUND ===
router.post('/approve-refund/:txId', authMiddleware, async (req, res) => {
  try {
    const { txId } = req.params;
    const receiver = await User.findByPk(req.user.id);

    const recvTx = await Transaction.findOne({
      where: { id: txId, userId: req.user.id }
    });

    if (!recvTx || recvTx.type !== 'receive' || recvTx.status !== 'refund_requested') {
      return res.status(400).json({ msg: 'Not a valid refund request' });
    }

    const sender = await User.findOne({ where: { email: recvTx.from } });
    if (!sender) return res.status(404).json({ msg: 'Sender not found' });

    const sendTx = await Transaction.findOne({
      where: {
        userId: sender.id,
        type: 'send',
        amount: recvTx.amount,
        to: receiver.email,
        status: 'refund_requested'
      }
    });

    if (parseFloat(receiver.balance) < parseFloat(recvTx.amount)) {
      return res.status(400).json({ msg: 'Insufficient balance to issue refund' });
    }

    // Process refund
    receiver.balance = parseFloat(receiver.balance) - parseFloat(recvTx.amount);
    sender.balance = parseFloat(sender.balance) + parseFloat(recvTx.amount);
    
    recvTx.status = 'refunded';
    if (sendTx) sendTx.status = 'refunded';

    await recvTx.save();
    if (sendTx) await sendTx.save();

    // Log new transactions
    await Transaction.create({
      userId: sender.id,
      type: 'receive',
      amount: recvTx.amount,
      status: 'completed',
      description: 'Refund received',
      from: receiver.email,
      date: new Date()
    });

    await Transaction.create({
      userId: receiver.id,
      type: 'send',
      amount: recvTx.amount,
      status: 'completed',
      description: 'Refund sent',
      to: sender.email,
      date: new Date()
    });

    await receiver.save();
    await sender.save();

    await sendEmail({ to: sender.email, subject: '✅ Refund Approved', html: `Refund of $${parseFloat(recvTx.amount).toFixed(2)} has been approved.` });
    await sendEmail({ to: receiver.email, subject: 'You Refunded a Payment', html: `You refunded $${parseFloat(recvTx.amount).toFixed(2)} to ${sender.email}` });
    
    res.json({ msg: 'Refund approved.' });
  } catch (err) {
    console.error('Approve Refund Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

router.post('/reject-refund/:txId', authMiddleware, async (req, res) => {
  try {
    const { txId } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 3) {
      return res.status(400).json({ msg: 'Reason for rejection is required.' });
    }

    const recvTx = await Transaction.findOne({
      where: { id: txId, userId: req.user.id }
    });

    if (!recvTx || recvTx.type !== 'receive' || recvTx.status !== 'refund_requested') {
      return res.status(404).json({ msg: 'Refund request not found or invalid' });
    }

    const sender = await User.findOne({ where: { email: recvTx.from } });
    if (!sender) return res.status(404).json({ msg: 'Sender not found' });

    const sendTx = await Transaction.findOne({
      where: {
        userId: sender.id,
        to: req.user.email,
        amount: recvTx.amount,
        status: 'refund_requested'
      }
    });

    recvTx.status = 'completed';
    if (sendTx) sendTx.status = 'completed';

    await recvTx.save();
    if (sendTx) await sendTx.save();

    await sendEmail({
      to: sender.email,
      subject: '🚫 Refund Request Rejected',
      html: `<p>Your refund request for <strong>$${parseFloat(recvTx.amount).toFixed(2)}</strong> to <strong>${req.user.name}</strong> was rejected.</p>
             <p><strong>Reason:</strong> ${reason}</p>`
    });

    res.json({ msg: 'Refund rejected.' });
  } catch (err) {
    console.error('Reject Refund Error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// === SAVINGS / EARNING ===
router.post('/savings/deposit', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ msg: 'Invalid amount' });

  try {
    const user = await User.findByPk(req.user.id);
    if (user.balance < amount) return res.status(400).json({ msg: 'Insufficient balance' });

    user.balance = parseFloat(user.balance) - parseFloat(amount);
    user.savingsBalance = parseFloat(user.savingsBalance) + parseFloat(amount);

    await Transaction.create({
      userId: user.id,
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
    const user = await User.findByPk(req.user.id);
    if (user.savingsBalance < amount) return res.status(400).json({ msg: 'Insufficient savings balance' });

    user.savingsBalance = parseFloat(user.savingsBalance) - parseFloat(amount);
    user.balance = parseFloat(user.balance) + parseFloat(amount);

    await Transaction.create({
      userId: user.id,
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
