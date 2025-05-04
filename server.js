const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const app = express();
const cors = require('cors');
app.use(cors());
const walletRoutes = require('./routes/wallet');




dotenv.config();
require('./config/db')(); // connect to MongoDB

app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', require('./routes/wallet'));
// Protected example
app.get('/', (req, res) => res.send('IyonicPay API Running'));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
