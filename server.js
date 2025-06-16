const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const app = express();
const cors = require('cors');
app.use(cors());
const walletRoutes = require('./routes/wallet');
const publicRoutes = require('./routes/public'); // or wherever the file is
const adminRoutes = require('./routes/admin');
const nodemailer = require('nodemailer');

const newsletterRoutes = require('./routes/newsletter');

const helmet = require('helmet');

dotenv.config();
require('./config/db')(); // connect to MongoDB

app.use(express.json());
app.use('/api', publicRoutes);
app.use('/api', newsletterRoutes);
app.use(helmet());
// Routes
app.use('/api/auth', authRoutes);
app.use('/api/wallet', require('./routes/wallet'));

app.use('/api/admin', adminRoutes);
// Protected example
app.get('/', (req, res) => res.send('IyonicPay API Running'));


    app.post('/send-email', async (req, res) => {
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
