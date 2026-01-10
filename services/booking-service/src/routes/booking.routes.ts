import express from "express";
import * as BookingController from "../controllers/booking.controller.js";
import {
  authenticateRequest,
  authorizeRole,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/public/health-check", BookingController.healthCheck);
router.get("/", authenticateRequest, BookingController.getBookingsByUserId);
router.get("/:id", BookingController.getBookingById);
router.post("/", authenticateRequest, BookingController.createBooking);
router.get(
  "/public/:showtimeId/booking-seat",
  BookingController.getBookingSeatsByShowtimeId
);
router.get(
  "/dashboard/revenue",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  BookingController.getRevenueByPeriod
);
router.get(
  "/dashboard/revenue/movie",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  BookingController.getRevenueAndOccupancyByMovie
);
router.get(
  "/dashboard/revenue/cinema",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  BookingController.getRevenueAndOccupancyByCinema
);
router.get(
  "/dashboard/get-all",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  BookingController.getBookings
);
router.put("/update-status/:id", BookingController.updateBookingStatus);
router.get(
  "/dashboard/peak-hours",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  BookingController.getPeakHoursInMonth
);
router.post(
  "/verify-booking",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER", "EMPLOYEE"),
  BookingController.maskBookingAsUsed
);

export default router;
