const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');

dotenv.config();

const authRoutes = require('./routes/auth');
const walletRoutes = require('./routes/wallet');
const publicPayments = require('./routes/publicPayments');
const connectDB = require('./config/db');

const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors({
    origin: true,
    credentials: true
  }));
  
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/public', publicPayments);

// Serve static files (like pay.html)
app.use(express.static(path.join(__dirname, 'public')));

// Explicit route for pay.html to support links like ?id=userId
app.get('/pay.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'pay.html'));
});

// Base route
app.get('/', (req, res) => {
  res.send('✅ IyonicPay API Running');
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server started on port ${PORT}`));
