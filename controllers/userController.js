// controllers/userController.js
const DefaultAmount = require('../models/DefaultAmount');

exports.saveDefaultAmount = async (req, res) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({ msg: 'Missing userId or amount' });
    }

    const existing = await DefaultAmount.findOne({ userId });
    if (existing) {
      existing.amount = amount;
      await existing.save();
    } else {
      await DefaultAmount.create({ userId, amount });
    }

    res.status(200).json({ msg: 'Saved successfully' });
  } catch (err) {
    console.error('Error saving default amount:', err);
    res.status(500).json({ msg: 'Server error' });
  }
};
