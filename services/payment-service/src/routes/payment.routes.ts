import express from "express";
import * as PaymentController from "../controllers/payment.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/:id", verifyToken, PaymentController.getPaymentById);
router.get("/", verifyToken, PaymentController.getPaymentsByUserId);
router.post("/momo/checkout", verifyToken, PaymentController.checkoutWithMoMo);
router.post("/momo/callback", PaymentController.callbackMoMo);
router.get("/momo/status/:id", PaymentController.checkStatusTransactionMoMo);
router.post(
  "/vnpay/checkout",
  verifyToken,
  PaymentController.checkoutWithVnPay
);
router.get("/vnpay/callback", PaymentController.callbackVnPay);
router.post(
  "/zalopay/checkout",
  verifyToken,
  PaymentController.checkoutWithZaloPay
);
router.post("/zalopay/callback", PaymentController.callbackZaloPay);
router.get(
  "/zalopay/status/:id",
  PaymentController.checkStatusTransactionZaloPay
);

export default router;
