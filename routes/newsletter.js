const express = require('express');
const router = express.Router();
const sendEmail = require('../utils/sendEmail');

router.post('/newsletter', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  try {
    // Send email to admin
    await sendEmail({
      to: "iyonicpay@gmail.com",
      subject: 'New Newsletter Subscriber',
      html: `<p><strong>Email:</strong> ${email}</p>`,
      text: `New Newsletter Subscriber: ${email}`
    });

    // Send confirmation email to user
    await sendEmail({
      to: email,
      subject: 'Welcome to IyonicPay Updates!',
      html: `
        <h3>Thank you for subscribing!</h3>
        <p>We’re excited to have you on board. You’ll now receive exclusive updates, feature announcements, and payment tips.</p>
        <br>
        <p>– The IyonicPay Team </p>
      `,
      text: `Thank you for subscribing! We're excited to have you on board. You'll now receive exclusive updates, feature announcements, and payment tips. – The IyonicPay Team`
    });

    res.status(200).json({ message: 'Newsletter subscription received' });
  } catch (err) {
    console.error('Newsletter error:', err.message);
    res.status(500).json({ error: 'Failed to send emails' });
  }
});

module.exports = router;
