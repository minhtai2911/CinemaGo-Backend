import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import CryptoJS from "crypto-js";
import axios from "axios";
import moment from "moment";

export const getPaymentsByUserId = async ({
  userId,
  page = 1,
  limit = 10,
}: {
  userId: string;
  page?: number;
  limit?: number;
}) => {
  // Fetch payments for a specific user with pagination
  const payments = await prisma.payment.findMany({
    where: {
      userId,
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  // Count total payments for pagination
  const totalItems = await prisma.payment.count({
    where: {
      userId,
    },
  });
  logger.info("Fetched payments for user", {
    userId,
    payments,
    totalItems,
    page,
    limit,
  });
  return {
    payments,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getPaymentById = async (paymentId: string) => {
  // Fetch a payment by its ID
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });
  // If payment not found, throw a custom error
  if (!payment) {
    logger.warn("Payment not found", { paymentId });
    throw new CustomError("Payment not found", 404);
  }
  logger.info("Fetched payment", { payment });
  return payment;
};

export const createPayment = async ({
  userId,
  amount,
  bookingId,
  method,
}: {
  userId: string;
  amount: number;
  bookingId: string;
  method: string;
}) => {
  // Create a new payment record
  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      bookingId,
      method,
    },
  });

  logger.info("Created payment", { payment });
  return payment;
};

export const checkoutWithMoMo = async ({
  amount,
  paymentId,
}: {
  amount: number;
  paymentId: string;
}) => {
  // Prepare the MoMo payment request
  const accessKey = process.env.ACCESS_KEY_MOMO as string;
  const secretKey = process.env.SECRET_KEY_MOMO as string;
  const orderInfo = "Checkout with MoMo";
  const partnerCode = "MOMO";
  const redirectUrl = process.env.URL_CHECKOUT_COMPLETED as string;
  const ipnUrl = `${process.env.LINK_NGROK}/v1/payments/momo/callback`;
  const requestType = "payWithMethod";
  const orderId = paymentId;
  const requestId = orderId;
  const extraData = "";
  const orderGroupId = "";
  const autoCapture = true;
  const lang = "vi";

  // Create the raw signature for MoMo API
  let rawSignature =
    "accessKey=" +
    accessKey +
    "&amount=" +
    amount +
    "&extraData=" +
    extraData +
    "&ipnUrl=" +
    ipnUrl +
    "&orderId=" +
    orderId +
    "&orderInfo=" +
    orderInfo +
    "&partnerCode=" +
    partnerCode +
    "&redirectUrl=" +
    redirectUrl +
    "&requestId=" +
    requestId +
    "&requestType=" +
    requestType;

  // Generate the signature using HMAC SHA256
  const signature = CryptoJS.HmacSHA256(rawSignature, secretKey).toString();

  // Prepare the request body for MoMo API
  const requestBody = JSON.stringify({
    partnerCode: partnerCode,
    partnerName: "Test",
    storeId: "MomoTestStore",
    requestId: requestId,
    amount: amount,
    orderId: orderId,
    orderInfo: orderInfo,
    redirectUrl: redirectUrl,
    ipnUrl: ipnUrl,
    lang: lang,
    requestType: requestType,
    autoCapture: autoCapture,
    extraData: extraData,
    orderGroupId: orderGroupId,
    signature: signature,
  });

  // Make the API call to MoMo to create the payment
  const options = {
    method: "POST",
    url: "https://test-payment.momo.vn/v2/gateway/api/create",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(requestBody),
    },
    data: requestBody,
  };

  // Send the request to MoMo API
  const response = await axios(options);
  logger.info("MoMo payment created successfully", {
    response: response.data,
  });
  return { payUrl: response.data.payUrl, paymentId };
};

export const callbackMoMo = async (
  redisClient: any,
  resultCode: number,
  paymentId: string
) => {
  // Handle the callback from MoMo after payment
  if (resultCode !== 0) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    await axios.delete(
      `${process.env.BOOKING_SERVICE_URL}/api/bookings/${payment?.bookingId}`
    );

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    logger.error("MoMo payment failed", { resultCode, paymentId });
    throw new CustomError("Payment failed", 400);
  }

  await handlePaymentSuccess(redisClient, paymentId);

  return { message: "MoMo payment successful" };
};

export const checkStatusTransactionMoMo = async (
  redisClient: any,
  paymentId: string
) => {
  // Prepare the request to check the payment status with MoMo
  const accessKey = process.env.ACCESS_KEY_MOMO as string;
  const secretKey = process.env.SECRET_KEY_MOMO as string;
  const orderId = paymentId;
  const partnerCode = "MOMO";

  // Create the raw signature for checking payment status
  const rawSignature = `accessKey=${accessKey}&orderId=${orderId}&partnerCode=${partnerCode}&requestId=${orderId}`;

  // Generate the signature using HMAC SHA256
  const signature = CryptoJS.HmacSHA256(rawSignature, secretKey).toString();

  // Prepare the request body for MoMo API
  const requestBody = JSON.stringify({
    partnerCode: "MOMO",
    requestId: orderId,
    orderId: orderId,
    signature: signature,
    lang: "vi",
  });

  // Make the API call to MoMo to check the payment status
  const options = {
    method: "POST",
    url: "https://test-payment.momo.vn/v2/gateway/api/query",
    headers: {
      "Content-Type": "application/json",
    },
    data: requestBody,
  };

  // Send the request to MoMo API
  const response = await axios(options);

  // Check if the response indicates a successful status check
  if (response.data.resultCode !== 0) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    await axios.delete(
      `${process.env.BOOKING_SERVICE_URL}/api/bookings/${payment?.bookingId}`
    );

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    logger.info("MoMo payment failed", {
      paymentId,
      data: response.data,
    });
    return {
      resultCode: response.data.resultCode,
      message: "MoMo payment failed",
    };
  }
  // Update the payment status in the database
  const payment = await handlePaymentSuccess(redisClient, paymentId);

  return payment;
};

export const checkoutWithVnPay = async ({
  amount,
  paymentId,
  ipAddr,
}: {
  amount: number;
  paymentId: string;
  ipAddr: string;
}) => {
  // Prepare the VnPay payment request
  const orderId = paymentId;
  const orderInfo = "Thanh toán đơn hàng";
  const createDate = moment(new Date()).format("YYYYMMDDHHmmss");
  const bankCode = "NCB";

  const vnpUrl = process.env.VNP_URL as string;
  const vnpReturnUrl = `${process.env.LINK_NGROK}/v1/payments/vnpay/callback`;
  const vnpTmnCode = process.env.VNP_TMN_CODE as string;
  const vnpHashSecret = process.env.VNP_HASH_SECRET as string;

  // Build params with all string values
  const vnpParams: Record<string, string> = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: vnpTmnCode,
    vnp_Amount: (amount * 100).toString(),
    vnp_CurrCode: "VND",
    vnp_BankCode: bankCode,
    vnp_Locale: "vn",
    vnp_CreateDate: createDate,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: "other",
    vnp_ReturnUrl: vnpReturnUrl,
    vnp_IpAddr: ipAddr,
    vnp_TxnRef: orderId,
  };

  // Sort keys alphabetically before creating the query string (important for VNPAY)
  const sortedKeys = Object.keys(vnpParams).sort();
  const sortedParams: Record<string, string> = {};
  sortedKeys.forEach((key) => {
    sortedParams[key] = vnpParams[key];
  });

  // Create the query string
  const queryString = new URLSearchParams(sortedParams).toString();
  // Generate the secure hash using HMAC SHA512
  const secureHash = CryptoJS.HmacSHA512(queryString, vnpHashSecret).toString();
  vnpParams["vnp_SecureHash"] = secureHash;
  sortedParams["vnp_SecureHash"] = secureHash;
  const finalQuery = new URLSearchParams(sortedParams).toString();
  const url = `${vnpUrl}?${finalQuery}`;
  logger.info("VnPay payment URL created", {
    url,
  });
  return url;
};

export const callbackVnPay = async (
  redisClient: any,
  rawParams: Record<string, string>
) => {
  const vnpHashSecret = process.env.VNP_HASH_SECRET as string;
  const secureHash = rawParams["vnp_SecureHash"];
  const responseCode = rawParams["vnp_ResponseCode"];
  const paymentId = rawParams["vnp_TxnRef"];
  const amount = Number(rawParams["vnp_Amount"]) / 100;

  // Delete secure hash and secure hash type from params for signature verification
  const vnpParams: Record<string, string> = { ...rawParams };
  delete vnpParams["vnp_SecureHash"];
  delete vnpParams["vnp_SecureHashType"];

  // Sort the parameters alphabetically
  const sortedParams = Object.keys(vnpParams)
    .sort()
    .reduce((acc, key) => {
      acc[key] = vnpParams[key];
      return acc;
    }, {} as Record<string, string>);

  // Create the query string from sorted parameters
  const queryString = new URLSearchParams(sortedParams).toString();

  // Create HMAC SHA512 signature
  const signed = CryptoJS.HmacSHA512(queryString, vnpHashSecret).toString();

  // Verify the secure hash
  if (secureHash !== signed) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    await axios.delete(
      `${process.env.BOOKING_SERVICE_URL}/api/bookings/${payment?.bookingId}`
    );

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    logger.warn("Invalid secure hash", { secureHash, signed });
    throw new CustomError("Invalid secure hash", 400);
  }

  if (responseCode !== "00") {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    await axios.delete(
      `${process.env.BOOKING_SERVICE_URL}/api/bookings/${payment?.bookingId}`
    );

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    logger.error("VnPay payment failed", { responseCode, paymentId });
    throw new CustomError("Payment failed", 400);
  }

  await handlePaymentSuccess(redisClient, paymentId);

  return `${process.env.URL_CHECKOUT_COMPLETED}?status=success&paymentId=${paymentId}`;
};

export const checkoutWithZaloPay = async ({
  amount,
  paymentId,
}: {
  amount: number;
  paymentId: string;
}) => {
  // Prepare the ZaloPay payment request
  const app_id = process.env.APP_ID_ZALOPAY as string;
  const key1 = process.env.KEY1_ZALOPAY as string;
  const endpoint = process.env.CREATE_ENDPOINT_ZALOPAY as string;

  // Embed data to redirect after payment completion
  const embed_data = {
    redirectUrl: process.env.URL_CHECKOUT_COMPLETED as string,
  };

  // Create the transaction ID
  const app_trans_id = `${new Date()
    .toISOString()
    .slice(2, 10)
    .replace(/-/g, "")}_${paymentId.replace(/-/g, "")}`;

  // Prepare the ZaloPay parameters
  const zaloPayParams: Record<string, any> = {
    app_id,
    app_trans_id,
    app_user: "CinemaGo",
    app_time: Date.now(),
    item: JSON.stringify([
      {
        name: `Thanh toán đơn hàng ${paymentId}`,
        quantity: 1,
        price: amount,
      },
    ]),
    embed_data: JSON.stringify(embed_data),
    amount,
    callback_url: `${process.env.LINK_NGROK}/v1/payments/zalopay/callback`,
    description: `Thanh toán đơn hàng ${paymentId}`,
    bank_code: "",
  };

  // Create the data to sign
  const dataToSign = [
    zaloPayParams.app_id,
    zaloPayParams.app_trans_id,
    zaloPayParams.app_user,
    zaloPayParams.amount,
    zaloPayParams.app_time,
    zaloPayParams.embed_data,
    zaloPayParams.item,
  ].join("|");

  // Generate the signature using HMAC SHA256
  zaloPayParams.mac = CryptoJS.HmacSHA256(dataToSign, key1).toString();

  // Make the API call to ZaloPay to create the payment
  const result = await axios.post(endpoint, null, {
    params: zaloPayParams,
  });
  // Check if the response is successful

  if (result.data.return_code !== 1) {
    logger.error("Failed to create ZaloPay payment", {
      error: result.data,
      params: zaloPayParams,
    });
    throw new CustomError("Failed to create ZaloPay payment", 500);
  }

  logger.info("ZaloPay payment created successfully", {
    paymentId,
    amount,
    result: result.data,
  });
  return result.data.order_url;
};

export const callbackZaloPay = async (
  redisClient: any,
  app_trans_id: string,
  amount: number,
  mac: string,
  data: string
) => {
  // Handle the callback from ZaloPay after payment
  const key2 = process.env.KEY2_ZALOPAY as string;
  // Extract the payment ID from the transaction ID
  const paymentId = app_trans_id
    .split("_")[1]
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");

  const expected = CryptoJS.HmacSHA256(data, key2).toString();

  if (expected !== mac) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    await axios.delete(
      `${process.env.BOOKING_SERVICE_URL}/api/bookings/${payment?.bookingId}`
    );

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    logger.warn("Invalid ZaloPay callback signature", {
      expected,
      received: mac,
    });
    throw new CustomError("Invalid ZaloPay callback signature", 400);
  }

  await handlePaymentSuccess(redisClient, paymentId);

  return { message: "ZaloPay payment successful" };
};

export const checkStatusTransactionZaloPay = async (
  redisClient: any,
  app_trans_id: string
) => {
  // Prepare the request to check the payment status with ZaloPay
  const app_id = process.env.APP_ID_ZALOPAY as string;
  const key1 = process.env.KEY1_ZALOPAY as string;
  const endpoint = process.env.QUERY_ENDPOINT_ZALOPAY as string;

  const data = `${app_id}|${app_trans_id}|${key1}`;
  const mac = CryptoJS.HmacSHA256(data, key1).toString();

  const params = {
    app_id,
    app_trans_id,
    mac,
  };

  const result = await axios.post(endpoint, null, { params });

  const paymentId = app_trans_id
    .split("_")[1]
    .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");

  if (result.data.return_code !== 1) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    await axios.delete(
      `${process.env.BOOKING_SERVICE_URL}/api/bookings/${payment?.bookingId}`
    );

    await prisma.payment.delete({
      where: { id: paymentId },
    });

    logger.info("Zalopay payment failed", {
      data: result.data,
      params,
    });
    return {
      return_code: result.data.return_code,
      message: "Zalopay payment failed",
    };
  }

  const updatedPayment = handlePaymentSuccess(redisClient, paymentId);

  return updatedPayment;
};

export const handlePaymentSuccess = async (
  redisClient: any,
  paymentId: string
) => {
  // Handle payment success for any payment method
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
  });

  if (!payment) {
    logger.warn("Payment not found", { paymentId });
    throw new CustomError("Payment not found", 404);
  }

  if (payment.status === "Đã thanh toán") {
    logger.warn("Payment already completed", { paymentId });
    throw new CustomError("Payment already completed", 400);
  }

  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: "Đã thanh toán" },
  });

  const { data: booking } = await axios.get(
    `${process.env.BOOKING_SERVICE_URL}/api/bookings/${payment.bookingId}`
  );

  await Promise.all(
    booking.BookingSeat.map((seat: any) =>
      redisClient.publish(
        "seat-update-channel",
        JSON.stringify({
          showtimeId: booking.showtimeId,
          seatId: seat.seatId,
          status: "booked",
          expiresAt: null,
        })
      )
    )
  );

  logger.info("Payment marked as successful", { payment: updatedPayment });
  return updatedPayment;
};
