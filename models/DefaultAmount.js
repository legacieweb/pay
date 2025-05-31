const mongoose = require('mongoose');

const defaultAmountSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('DefaultAmount', defaultAmountSchema);
