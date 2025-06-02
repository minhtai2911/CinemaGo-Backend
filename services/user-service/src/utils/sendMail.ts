import nodemailer from "nodemailer";
import logger from "./logger.js";

export const sendMail = async (
  to: string,
  subject: string,
  html?: string
) => {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: `"CinemaGo" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  };

  try {
    logger.info("Sending email", { to, subject });
    await transporter.sendMail(mailOptions);
  } catch (error) {
    logger.error("Error sending email", { to, subject, error });
    throw error;
  }
};
