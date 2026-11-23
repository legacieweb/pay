const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const bcrypt = require('bcryptjs');

// Transaction sub-model
const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('deposit', 'send', 'receive', 'withdraw', 'requested'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'completed'
  },
  date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  description: {
    type: DataTypes.STRING
  },
  reference: {
    type: DataTypes.STRING
  },
  to: {
    type: DataTypes.STRING
  },
  from: {
    type: DataTypes.STRING
  },
  method: {
    type: DataTypes.STRING
  },
  country: {
    type: DataTypes.STRING
  },
  customerEmail: {
    type: DataTypes.STRING
  },
  customerName: {
    type: DataTypes.STRING
  },
  fee: {
    type: DataTypes.DECIMAL(15, 2)
  },
  creditsUsed: {
    type: DataTypes.DECIMAL(15, 2)
  },
  remainingFee: {
    type: DataTypes.DECIMAL(15, 2)
  },
  total: {
    type: DataTypes.DECIMAL(15, 2)
  },
  creditsEarned: {
    type: DataTypes.DECIMAL(15, 2)
  },
  refundReason: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'transactions',
  timestamps: true
});

// User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resetCode: {
    type: DataTypes.STRING
  },
  resetCodeExpires: {
    type: DataTypes.DATE
  },
  balance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  credits: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  savingsBalance: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  defaultAmount: {
    type: DataTypes.DECIMAL(15, 2)
  },
  defaultCurrency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
  },
  chargeFee: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  feePercentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 2
  },
  paystackPublicKey: {
    type: DataTypes.STRING
  },
  referredBy: {
    type: DataTypes.INTEGER
  },
  referralCode: {
    type: DataTypes.STRING,
    unique: true
  },
  withdrawalMethod: {
    type: DataTypes.STRING
  },
  withdrawalMethodLabel: {
    type: DataTypes.STRING
  },
  withdrawalCountry: {
    type: DataTypes.STRING
  },
  withdrawalAccountDetails: {
    type: DataTypes.STRING
  },
  payoutDetails: {
    type: DataTypes.TEXT
  }
}, {
  tableName: 'users',
  timestamps: true,
  hooks: {
    beforeSave: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

// Define associations
User.hasMany(Transaction, { foreignKey: 'userId' });
Transaction.belongsTo(User, { foreignKey: 'userId' });

// Helper method to compare password
User.prototype.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get transactions
User.prototype.getTransactions = async function() {
  return await Transaction.findAll({
    where: { userId: this.id },
    order: [['date', 'DESC']]
  });
};

// Add transaction to user
User.prototype.addTransaction = async function(txData) {
  return await Transaction.create({
    userId: this.id,
    ...txData
  });
};

// Find transaction by ID within user's transactions
User.prototype.findTransactionById = async function(txId) {
  return await Transaction.findByPk(txId);
};

// Backward compatibility for transactions array
Object.defineProperty(User.prototype, 'transactions', {
  get: function() {
    return this._transactions || [];
  },
  set: function(value) {
    this._transactions = value;
  }
});

// Store original findOne
const originalFindOne = User.findOne.bind(User);

// Mongoose-like static methods for backward compatibility
// Convert Mongoose syntax like { email } to Sequelize { where: { email } }
User.findOne = async function(query) {
  if (!query) return null;
  
  // If already has where clause, pass through
  if (query.where) {
    return originalFindOne(query);
  }
  
  // Convert Mongoose syntax { email } to { where: { email } }
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

module.exports = { User, Transaction };
