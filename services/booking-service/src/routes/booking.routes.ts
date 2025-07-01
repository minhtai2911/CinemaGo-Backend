import express from "express";
import * as BookingController from "../controllers/booking.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, BookingController.getBookingsByUserId);
router.get("/:id", verifyToken, BookingController.getBookingById);
router.post("/", verifyToken, BookingController.createBooking);
router.get(
  "/:showtimeId/booking-seat",
  BookingController.getBookingSeatsByShowtimeId
);

export default router;
