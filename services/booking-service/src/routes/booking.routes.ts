import express from "express";
import * as BookingController from "../controllers/booking.controller.js";
import { authenticateRequest, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", authenticateRequest, BookingController.getBookingsByUserId);
router.get("/:id", authenticateRequest, BookingController.getBookingById);
router.post("/", authenticateRequest, BookingController.createBooking);
router.get(
  "/public/:showtimeId/booking-seat",
  BookingController.getBookingSeatsByShowtimeId
);

export default router;
