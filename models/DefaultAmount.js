const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const DefaultAmount = sequelize.define('DefaultAmount', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  }
}, {
  tableName: 'default_amounts',
  timestamps: true
});

// Store original findOne
const originalFindOne = DefaultAmount.findOne.bind(DefaultAmount);

// Backward compatibility methods
DefaultAmount.findOne = async function(query) {
  if (!query) return null;

  // If already has where clause, pass through
  if (query.where) {
    return originalFindOne(query);
  }

  // Convert Mongoose syntax { userId } to { where: { userId } }
  const where = {};
  for (const key of Object.keys(query)) {
    if (key !== 'select' && key !== '$or' && key !== 'sort') {
      where[key] = query[key];
    }
  }

  if (Object.keys(where).length > 0) {
    return originalFindOne({ where });
  }

  return originalFindOne(query);
};

DefaultAmount.findOneAndDelete = async function(query) {
  const instance = await originalFindOne({ where: query.where || query });
  if (instance) {
    await instance.destroy();
    return instance;
  }
  return null;
};

DefaultAmount.findOneAndUpdate = async function(query, updateData) {
  const instance = await originalFindOne({ where: query.where || query });
  if (instance) {
    return await instance.update(updateData);
  }
  return null;
};

module.exports = DefaultAmount;
