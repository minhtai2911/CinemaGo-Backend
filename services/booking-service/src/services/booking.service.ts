import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";

export const getBookingsByUserId = async ({
  userId,
  page = 1,
  limit = 10,
}: {
  userId: string;
  page?: number;
  limit?: number;
}) => {
  // Fetch bookings for a specific user with pagination
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
    },
    include: {
      BookingSeat: true,
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  // Count total bookings for pagination
  const totalItems = await prisma.booking.count({
    where: {
      userId,
    },
  });
  logger.info("Fetched bookings for user", {
    userId,
    bookings,
    totalItems,
    page,
    limit,
  });
  return {
    bookings,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getBookingById = async (bookingId: string) => {
  // Fetch a booking by its ID
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      BookingSeat: true,
    },
  });
  // If booking not found, throw a custom error
  if (!booking) {
    logger.warn("Booking not found", { bookingId });
    throw new CustomError("Booking not found", 404);
  }
  logger.info("Fetched booking", { booking });
  return booking;
};

export const createBooking = async (
  redisClient: any,
  userId: string,
  showtimeId: string,
  seatIds: string[]
) => {
  for (const seatId of seatIds) {
    const key = `hold:${showtimeId}:${seatId}`;
    const holder = await redisClient.get(key);
    if (!holder) {
      logger.warn("Time out", { showtimeId, seatId });
      throw new CustomError("Time out", 400);
    }
    if (holder.userId !== userId) {
      logger.warn("Seat is already held by another user", {
        showtimeId,
        seatId,
        holder: holder.userId,
        userId,
      });
      throw new CustomError("Seat is already held by another user", 400);
    }
  }
  // Transaction to create a booking and delete held seats from Redis
  const result = await prisma.$transaction(async (tx: any) => {
    // Create a new booking
    const booking = await tx.booking.create({
      data: {
        userId,
        showtimeId,
        BookingSeat: {
          create: seatIds.map((seatId) => ({
            seatId,
            showtimeId,
          })),
        },
      },
      include: {
        BookingSeat: true,
      },
    });
    // Delete the held seats from Redis
    const deletePromises = seatIds.map((seatId) =>
      redisClient.del(`hold:${showtimeId}:${seatId}`)
    );
    await Promise.all(deletePromises);
    return booking;
  });

  return result;
};

export const getBookingSeatsByShowtimeId = async (showtimeId: string) => {
  // Fetch all booking seats for a specific showtime
  const bookingSeats = await prisma.bookingSeat.findMany({
    where: { showtimeId },
  });
  // If no booking seats found, throw a custom error
  if (!bookingSeats || bookingSeats.length === 0) {
    logger.warn("No booking seats found for showtime", { showtimeId });
    throw new CustomError("No booking seats found for this showtime", 404);
  }
  logger.info("Fetched booking seats for showtime", {
    showtimeId,
    bookingSeats,
  });
  return bookingSeats;
};
