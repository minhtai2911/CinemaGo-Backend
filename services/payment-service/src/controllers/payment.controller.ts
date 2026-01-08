import { Request, Response } from "express";
import * as paymentService from "../services/payment.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const checkoutWithMoMo = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { amount, bookingId, urlCompleted } = req.body;
    const method = "MOMO";

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!amount || !bookingId || !urlCompleted) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const { payUrl, bookingId: returnedBookingId } =
      await paymentService.checkoutWithMoMo({
        amount,
        bookingId,
        urlCompleted,
      });

    res.status(200).json({ URL: payUrl, bookingId: returnedBookingId });
  }
);

export const callbackMoMo = asyncHandler(
  async (req: Request, res: Response) => {
    const { resultCode, orderId } = req.body;

    if (resultCode == undefined || !orderId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const message = await paymentService.callbackMoMo(
      Number(resultCode),
      String(orderId)
    );

    res.status(200).json(message);
  }
);

export const checkStatusTransactionMoMo = asyncHandler(
  async (req: Request, res: Response) => {
    const bookingId = req.params.id;

    if (!bookingId) {
      return res.status(400).json({ message: "Missing payment ID" });
    }

    const message = await paymentService.checkStatusTransactionMoMo(bookingId);

    res.status(200).json(message);
  }
);

export const checkoutWithVnPay = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { amount, bookingId, urlCompleted } = req.body;
    const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!amount || !bookingId || !urlCompleted) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const paymentUrl = await paymentService.checkoutWithVnPay({
      amount,
      bookingId,
      ipAddr: String(ipAddr),
      urlCompleted,
    });

    res.status(200).json({ URL: paymentUrl });
  }
);

export const callbackVnPay = asyncHandler(
  async (req: Request, res: Response) => {
    const rawParams = req.query as Record<string, string>;
    const urlCompleted = req.query.urlCompleted as string;

    if (!rawParams) {
      return res.status(400).json({ message: "Missing query parameters" });
    }

    const url = await paymentService.callbackVnPay(rawParams, urlCompleted);

    res.redirect(url);
  }
);

export const checkoutWithZaloPay = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { amount, bookingId, urlCompleted } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!amount || !bookingId || !urlCompleted) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const paymentUrl = await paymentService.checkoutWithZaloPay({
      amount,
      bookingId,
      urlCompleted,
    });

    res.status(200).json({ URL: paymentUrl });
  }
);

export const callbackZaloPay = asyncHandler(
  async (req: Request, res: Response) => {
    const { app_trans_id, amount } = JSON.parse(req.body.data);
    const mac = req.body.mac;
    const data = req.body.data;

    if (!data || !mac || !app_trans_id || !amount) {
      return res.status(400).json({ message: "Missing query parameters" });
    }

    const message = await paymentService.callbackZaloPay(
      app_trans_id,
      amount,
      mac,
      data
    );
    res.status(200).json(message);
  }
);

export const checkStatusTransactionZaloPay = asyncHandler(
  async (req: Request, res: Response) => {
    const app_trans_id = req.params.id;

    if (!app_trans_id) {
      return res.status(400).json({ message: "Missing app_trans_id" });
    }

    const payment = await paymentService.checkStatusTransactionZaloPay(
      app_trans_id
    );
    res.status(200).json({ data: payment });
  }
);

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
