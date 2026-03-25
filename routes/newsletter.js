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
      host: "mail.privateemail.com", // Correct host for Namecheap Private Email
      port: 465,                     // SSL port
      secure: true,                  // true for 465, false for 587
      auth: {
        user: "hello@iyonicorp.com", // Your full email address
        pass: "@7Switched"        // Your email account password
      },
      tls: {
        // Helps avoid connection issues on some servers
        rejectUnauthorized: false
      }
    });

    // Verify connection configuration
    transporter.verify(function (error, success) {
      if (error) {
        console.log("Email service error:", error);
      } else {
        console.log("Email service is ready to send messages");
      }
    });

    const adminMail = {
      from: email,
      to: "hello@iyonicorp.com",
      subject: 'New Newsletter Subscriber',
      html: `<p><strong>Email:</strong> ${email}</p>`
    };

    const userMail = {
      from: "hello@iyonicorp.com",
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
