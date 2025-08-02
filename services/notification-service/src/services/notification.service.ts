import { transporter } from "../config/mailer.js";
import logger from "../utils/logger.js";

export const sendNotificationEmail = async (mailOptions: any) => {
  await transporter.sendMail(mailOptions);
  logger.info("Email sent successfully.");
  return { message: "Email sent successfully." };
};
