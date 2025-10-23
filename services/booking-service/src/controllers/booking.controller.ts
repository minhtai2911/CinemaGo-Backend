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

    const data = await bookingService.getBookingsByUserId({
      userId,
      page: Number(page) || undefined,
      limit: Number(limit) || undefined,
    });
    res.status(200).json({
      pagination: {
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        currentPage: Number(page) || 1,
        pageSize: Number(limit) || data.totalItems,
        hasNextPage: Number(page) ? Number(page) < data.totalPages : false,
        hasPrevPage: Number(page) ? Number(page) > 1 : false,
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
    let userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (req.user?.role !== "USER") {
      userId = undefined; // For ADMIN or EMPLOYEE, set userId to undefined to allow booking on behalf of users
    }

    const { showtimeId, seatIds, foodDrinks } = req.body;
    if (!showtimeId) {
      return res.status(400).json({ message: "Invalid booking data" });
    }

    const booking = await bookingService.createBooking(
      req.redisClient,
      userId,
      showtimeId,
      seatIds || [],
      foodDrinks || []
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

export const getRevenueByPeriod = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const revenue = await bookingService.getRevenueByPeriod(start, end);
    res.status(200).json({ data: revenue });
  }
);

export const getRevenueByPeriodAndCinema = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const revenue = await bookingService.getRevenueByPeriodAndCinema(
      start,
      end
    );
    res.status(200).json({ data: revenue });
  }
);

export const getRevenueByPeriodAndMovie = asyncHandler(
  async (req: Request, res: Response) => {
    const { startDate, endDate } = req.query;

    const start = startDate ? new Date(startDate as string) : undefined;
    const end = endDate ? new Date(endDate as string) : undefined;

    const revenue = await bookingService.getRevenueByPeriodAndMovie(start, end);

    res.status(200).json({ data: revenue });
  }
);
