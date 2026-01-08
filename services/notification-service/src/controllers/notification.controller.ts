import { Request, Response } from "express";
import * as Notification from "../services/notification.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const sendNotificationEmail = asyncHandler(
  async (req: Request, res: Response) => {
    const { to, subject, html } = req.body;
    if (!to || !subject) {
      return res.status(400).json({ error: "To and subject are required." });
    }
    const mailOptions = {
      from: `"CinemaGo" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
    };
    const message = await Notification.sendNotificationEmail(mailOptions);
    res.status(200).json(message);
  }
);

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
