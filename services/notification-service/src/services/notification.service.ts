import { transporter } from "../config/mailer.js";
import logger from "../utils/logger.js";
import { Resend } from "resend";

export const sendNotificationEmail = async (mailOptions: any) => {
  if (`${process.env.NODE_ENV}` == "production") {
    const resend = new Resend(`${process.env.RESEND_API_KEY!}`);

    await resend.emails.send({
      from: `"CinemaGo" <onboarding@resend.dev>`,
      to: mailOptions.to,
      subject: mailOptions.subject,
      html: mailOptions.html,
    });
  } else {
    await transporter.sendMail(mailOptions);
  }
  logger.info("Email sent successfully.");
  return { message: "Email sent successfully." };
};
