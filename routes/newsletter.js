const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');

router.post('/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // example: 'support@iyonicorp.com'
        pass: process.env.EMAIL_PASS
      }
    });

    const adminMail = {
      from: email,
      to: process.env.EMAIL_USER,
      subject: 'New Newsletter Subscriber',
      html: `<p><strong>Email:</strong> ${email}</p>`
    };

    const userMail = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Welcome to IyonicPay Updates!',
      html: `
        <h3>Thank you for subscribing!</h3>
        <p>We’re excited to have you on board. You’ll now receive exclusive updates, feature announcements, and payment tips.</p>
        <br>
        <p>– The IyonicPay Team </p>
      `
    };

    await transporter.sendMail(adminMail);
    await transporter.sendMail(userMail);

    res.status(200).json({ message: 'Newsletter subscription received' });
  } catch (err) {
    console.error('Newsletter error:', err);
    res.status(500).json({ error: 'Failed to send emails' });
  }
});

module.exports = router;
