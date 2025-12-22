import express from "express";
import * as PaymentController from "../controllers/payment.controller.js";
import { authenticateRequest } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post(
  "/momo/checkout",
  authenticateRequest,
  PaymentController.checkoutWithMoMo
);
router.post("/momo/callback", PaymentController.callbackMoMo);
router.get(
  "/public/momo/status/:id",
  PaymentController.checkStatusTransactionMoMo
);
router.post(
  "/vnpay/checkout",
  authenticateRequest,
  PaymentController.checkoutWithVnPay
);
router.get("/vnpay/callback", PaymentController.callbackVnPay);
router.post(
  "/zalopay/checkout",
  authenticateRequest,
  PaymentController.checkoutWithZaloPay
);
router.post("/zalopay/callback", PaymentController.callbackZaloPay);
router.get(
  "/public/zalopay/status/:id",
  PaymentController.checkStatusTransactionZaloPay
);

export default router;
