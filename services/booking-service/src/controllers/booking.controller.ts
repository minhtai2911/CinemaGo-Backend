import { Request, Response } from "express";
import * as bookingService from "../services/booking.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const getBookingsByUserId = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    const { page, limit } = req.query;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const data = await bookingService.getBookingsByUserId({
      userId,
      page: pageNumber,
      limit: limitNumber,
    });
    res.status(200).json({
      pagination: {
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber > data.totalItems ? data.totalItems : limitNumber,
        hasNextPage: pageNumber < data.totalPages,
        hasPrevPage: pageNumber > 1,
      },
      data: data.bookings,
    });
  }
);

export const getBookingById = asyncHandler(
  async (req: Request, res: Response) => {
    const bookingId = req.params.id;
    const booking = await bookingService.getBookingById(bookingId);
    res.status(200).json({ data: booking });
  }
);

export const createBooking = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { showtimeId, seatIds } = req.body;
    if (!showtimeId || !seatIds || !Array.isArray(seatIds)) {
      return res.status(400).json({ message: "Invalid booking data" });
    }
    const booking = await bookingService.createBooking(
      req.redisClient,
      userId,
      showtimeId,
      seatIds
    );
    res.status(201).json({ data: booking });
  }
);

export const getBookingSeatsByShowtimeId = asyncHandler(
  async (req: Request, res: Response) => {
    const showtimeId = req.params.showtimeId;
    if (!showtimeId) {
      return res.status(400).json({ message: "Showtime ID is required" });
    }
    const seats = await bookingService.getBookingSeatsByShowtimeId(showtimeId);
    res.status(200).json({ data: seats });
  }
);
