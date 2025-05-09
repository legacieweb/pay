const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// ✅ Middleware to verify admin token
const verifyAdmin = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET); // Use ADMIN_SECRET
    if (decoded.role !== 'admin') return res.status(403).json({ msg: 'Access denied' });
    next();
  } catch (err) {
    return res.status(401).json({ msg: 'Unauthorized' });
  }
};

// ✅ Admin login route
router.post('/login', (req, res) => {
  const { password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ msg: 'Invalid password' });
  }

  const token = jwt.sign({ role: 'admin' }, process.env.ADMIN_SECRET, {
    expiresIn: '2h',
  });

  res.json({ token });
});

// ✅ Get all transactions across users
router.get('/transactions', verifyAdmin, async (req, res) => {
  try {
    const users = await User.find({}, 'name email transactions');
    const allTransactions = [];

    users.forEach(user => {
      user.transactions.forEach(tx => {
        allTransactions.push({
          userName: user.name,
          email: user.email,
          type: tx.type,
          amount: tx.amount || 0,
          to: tx.to,
          from: tx.from,
          status: tx.status || 'completed',
          date: tx.date || new Date(),
        });
      });
    });

    res.json(allTransactions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});


router.get('/user', verifyAdmin, async (req, res) => {
  const user = await User.findOne({ email: req.query.email });
  if (!user) return res.status(404).json({ msg: 'User not found' });
  res.json(user);
});

router.get('/user-transactions', verifyAdmin, async (req, res) => {
  const user = await User.findById(req.query.userId);
  if (!user) return res.status(404).json({ msg: 'User not found' });
  res.json(user.transactions);
});


router.patch('/withdraw-status', verifyAdmin, async (req, res) => {
  const user = await User.findOne({ 'transactions._id': req.body.txId });
  const tx = user.transactions.id(req.body.txId);
  tx.status = 'Processed';
  await user.save();
  res.json({ msg: 'Withdrawal status updated' });
});


module.exports = router;
