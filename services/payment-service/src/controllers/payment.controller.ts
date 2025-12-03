import { Request, Response } from "express";
import * as paymentService from "../services/payment.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const getPaymentsByUserId = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { page, limit } = req.query;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;

    const data = await paymentService.getPaymentsByUserId({
      userId,
      page: pageNumber,
      limit: limitNumber,
    });

    return res.status(200).json({
      pagination: {
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber > data.totalItems ? data.totalItems : limitNumber,
        hasNextPage: pageNumber < data.totalPages,
        hasPrevPage: pageNumber > 1,
      },
      data: data.payments,
    });
  }
);

export const getPaymentById = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentId = req.params.id;
    const payment = await paymentService.getPaymentById(paymentId);
    res.status(200).json({ data: payment });
  }
);

export const checkoutWithMoMo = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { amount, bookingId } = req.body;
    const method = "MOMO";

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!amount || !bookingId) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    const payment = await paymentService.createPayment({
      userId,
      amount,
      bookingId,
      method,
    });

    const { payUrl, paymentId } = await paymentService.checkoutWithMoMo({
      amount,
      paymentId: payment.id,
    });

    res.status(200).json({ URL: payUrl, paymentId });
  }
);

export const callbackMoMo = asyncHandler(
  async (req: Request, res: Response) => {
    const { resultCode, orderId } = req.body;

    if (resultCode == undefined || !orderId) {
      return res.status(400).json({ message: "Missing required parameters" });
    }

    const message = await paymentService.callbackMoMo(
      req.redisClient,
      Number(resultCode),
      String(orderId)
    );

    res.status(200).json(message);
  }
);

export const checkStatusTransactionMoMo = asyncHandler(
  async (req: Request, res: Response) => {
    const paymentId = req.params.id;

    if (!paymentId) {
      return res.status(400).json({ message: "Missing payment ID" });
    }

    const payment = await paymentService.checkStatusTransactionMoMo(
      req.redisClient,
      paymentId
    );
    res.status(200).json({ data: payment });
  }
);

export const checkoutWithVnPay = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { amount, bookingId } = req.body;
    const method = "VNPAY";
    const ipAddr = req.headers["x-forwarded-for"] || req.socket.remoteAddress;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!amount || !bookingId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const payment = await paymentService.createPayment({
      userId,
      amount,
      bookingId,
      method,
    });

    const paymentUrl = await paymentService.checkoutWithVnPay({
      amount,
      paymentId: payment.id,
      ipAddr: String(ipAddr),
    });

    res.status(200).json({ URL: paymentUrl });
  }
);

export const callbackVnPay = asyncHandler(
  async (req: Request, res: Response) => {
    const rawParams = req.query as Record<string, string>;

    if (!rawParams) {
      return res.status(400).json({ message: "Missing query parameters" });
    }

    const url = await paymentService.callbackVnPay(req.redisClient, rawParams);
    res.redirect(url);
  }
);

export const checkoutWithZaloPay = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { amount, bookingId } = req.body;
    const method = "ZALOPAY";

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!amount || !bookingId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const payment = await paymentService.createPayment({
      userId,
      amount,
      bookingId,
      method,
    });

    const paymentUrl = await paymentService.checkoutWithZaloPay({
      amount,
      paymentId: payment.id,
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
      req.redisClient,
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
      req.redisClient,
      app_trans_id
    );
    res.status(200).json({ data: payment });
  }
);
