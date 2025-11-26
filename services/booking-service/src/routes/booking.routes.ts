import express from "express";
import * as BookingController from "../controllers/booking.controller.js";
import {
  authenticateRequest,
  authorizeRole,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticateRequest, BookingController.getBookingsByUserId);
router.get("/:id", authenticateRequest, BookingController.getBookingById);
router.post("/", authenticateRequest, BookingController.createBooking);
router.get(
  "/public/:showtimeId/booking-seat",
  BookingController.getBookingSeatsByShowtimeId
);
router.get(
  "/dashboard/revenue",
  authenticateRequest,
  authorizeRole("ADMIN"),
  BookingController.getRevenueByPeriod
);
router.get(
  "/dashboard/revenue/movie",
  authenticateRequest,
  authorizeRole("ADMIN"),
  BookingController.getRevenueByPeriodAndMovie
);
router.get(
  "/dashboard/revenue/cinema",
  authenticateRequest,
  authorizeRole("ADMIN"),
  BookingController.getRevenueByPeriodAndCinema
);
router.get(
  "/dashboard/get-all",
  authenticateRequest,
  authorizeRole("ADMIN"),
  BookingController.getBookings
);

export default router;
