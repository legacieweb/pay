const nodemailer = require('nodemailer');

const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"IyonicPay💸" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text: text || '', // fallback for clients that don't support HTML
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📨 Email sent to ${to}: ${info.messageId}`);
  } catch (error) {
    console.error(`❌ Failed to send email to ${to}:`, error.message);
  }
};

module.exports = sendEmail;
