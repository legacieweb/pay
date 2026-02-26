const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const nodemailer = require('nodemailer');

dotenv.config();

const app = express();

// Global Middleware
app.use(cors());
app.use(express.json());
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false, // Disabling CSP for now to ensure all external scripts like Paystack load
}));

// Connect to MongoDB
require('./config/db')(); 

// Page Routes (before static)
app.get('/request', (req, res) => res.sendFile(path.join(__dirname, 'request', 'index.html')));
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'dashboard', 'index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, 'signup', 'index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login', 'index.html')));

// Static Files
app.use('/request', express.static(path.join(__dirname, 'request')));
app.use('/dashboard', express.static(path.join(__dirname, 'dashboard')));
app.use('/signup', express.static(path.join(__dirname, 'signup')));
app.use('/login', express.static(path.join(__dirname, 'login')));
app.use(express.static(path.join(__dirname))); // Root static for index.html, etc.

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/wallet', require('./routes/wallet'));
app.use('/api/public', require('./routes/public'));
app.use('/api', require('./routes/newsletter'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/config/paystack', (req, res) => {
  res.json({ publicKey: process.env.PAYSTACK_PUBLIC_KEY || '' });
});

// Home Route
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.post('/api/send-email', async (req, res) => {
  const { name, email, message } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Email to site admin
    const adminMail = {
      from: email,
      to: process.env.EMAIL_USER,
      subject: `New Message from ${name}`,
      html: `
        <h2>Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    };

    // Confirmation email to sender
    const userMail = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'We received your message — IyonicPay',
      html: `
        <h2>Hello ${name},</h2>
        <p>Thank you for reaching out to IyonicPay.</p>
        <p>We’ve received your message and will respond shortly.</p>
        <hr/>
        <p><strong>Your Message:</strong></p>
        <p>${message}</p>
        <br/>
        <p>Best regards,<br/>IyonicPay Support Team</p>
      `
    };

    await transporter.sendMail(adminMail);
    await transporter.sendMail(userMail);

    res.status(200).json({ message: 'Message sent successfully! Confirmation sent to your email.' });
  } catch (err) {
    console.error('Email sending error:', err);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});



const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
