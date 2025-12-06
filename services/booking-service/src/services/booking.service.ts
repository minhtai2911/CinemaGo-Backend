import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import axios from "axios";

export const getBookingsByUserId = async ({
  userId,
  page,
  limit,
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
      bookingSeats: true,
      bookingFoodDrinks: true,
    },
    ...(page && limit
      ? {
          skip: (page - 1) * limit,
          take: limit,
        }
      : {}),
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
    totalPages: limit ? Math.ceil(totalItems / limit) : 1,
  };
};

export const getBookingById = async (bookingId: string) => {
  // Fetch a booking by its ID
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingSeats: true,
      bookingFoodDrinks: true,
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
  userId: string | undefined,
  showtimeId: string,
  seatIds: string[],
  foodDrinks: { foodDrinkId: string; quantity: number }[],
  type?: string
) => {
  let totalPrice: number = 0;
  for (const seatId of seatIds) {
    const key = `hold:${showtimeId}:${seatId}`;
    const rawHolder = await redisClient.get(key);
    // Check if the seat is held in Redis
    if (!rawHolder) {
      logger.warn("Seat is not held or time out", { showtimeId, seatId });
      throw new CustomError("Seat is not held or time out", 400);
    }
    // Parse the holder information from Redis
    const holder = JSON.parse(rawHolder);
    if (holder.userId !== userId) {
      logger.warn("Seat is already held by another user", {
        showtimeId,
        seatId,
        holder: holder.userId,
        userId,
      });
      throw new CustomError("Seat is already held by another user", 400);
    }
    const showtime = await axios.get(
      `${process.env.SHOWTIME_SERVICE_URL}/api/showtimes/public/${showtimeId}`
    );
    // Check if the showtime exists
    if (!showtime || !showtime.data || !showtime.data.data) {
      logger.warn("Showtime not found", { showtimeId });
      throw new CustomError("Showtime not found", 404);
    }
    // Calculate the total price for the booking
    totalPrice += holder.extraPrice + showtime.data.data.price;
  }
  // Fetch food and drink details from the fooddrink service
  let bookingFoodDrinksData: {
    foodDrinkId: string;
    quantity: number;
    totalPrice: number;
  }[] = [];
  if (foodDrinks.length > 0) {
    const foodDrinkIds = foodDrinks.map((f) => f.foodDrinkId);

    const response = await axios.post(
      `${process.env.FOOD_DRINK_SERVICE_URL}/api/food-drinks/public/by-ids`,
      { ids: foodDrinkIds }
    );

    const foodDrinkList = response?.data?.data || [];

    bookingFoodDrinksData = foodDrinks.map((item) => {
      const foodInfo = foodDrinkList.find(
        (foodDrink: { id: string; price: number }) =>
          foodDrink.id === item.foodDrinkId
      );

      if (!foodInfo) {
        throw new CustomError(`FoodDrink ${item.foodDrinkId} not found`, 404);
      }

      const totalFoodPrice = foodInfo.price * item.quantity;
      totalPrice += totalFoodPrice;

      return {
        foodDrinkId: item.foodDrinkId,
        quantity: item.quantity,
        totalPrice: totalFoodPrice,
      };
    });
  }
  // Transaction to create a booking and delete held seats from Redis
  const result = await prisma.$transaction(async (tx: any) => {
    // Create a new booking
    const booking = await tx.booking.create({
      data: {
        userId,
        showtimeId,
        totalPrice,
        bookingSeats:
          seatIds.length > 0
            ? {
                create: seatIds.map((seatId) => ({
                  seatId,
                  showtimeId,
                })),
              }
            : undefined,
        bookingFoodDrinks:
          bookingFoodDrinksData.length > 0
            ? {
                create: bookingFoodDrinksData.map((item) => ({
                  foodDrinkId: item.foodDrinkId,
                  quantity: item.quantity,
                  totalPrice: item.totalPrice,
                })),
              }
            : undefined,
        type,
      },
      include: {
        bookingSeats: true,
        bookingFoodDrinks: true,
      },
    });

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

export const getRevenueByPeriod = async (
  startDate?: Date,
  endDate?: Date,
  type?: string
) => {
  // Calculate total revenue within a specific date range
  const revenueData = await prisma.booking.aggregate({
    where: {
      ...(startDate && endDate
        ? { createdAt: { gte: startDate, lte: endDate } }
        : {}),
      ...(type ? { type } : {}),
    },
    _sum: {
      totalPrice: true,
    },
  });

  const revenueDataFromFoodDrink = await prisma.bookingFoodDrink.aggregate({
    where: {
      booking: {
        ...(startDate && endDate
          ? { createdAt: { gte: startDate, lte: endDate } }
          : {}),
      },
    },
    _sum: {
      totalPrice: true,
    },
  });

  const totalRevenueFromFoodDrink =
    revenueDataFromFoodDrink._sum.totalPrice || 0;
  const totalRevenue = revenueData._sum.totalPrice || 0;

  logger.info("Calculated revenue for period", {
    startDate,
    endDate,
    totalRevenue,
    totalRevenueFromFoodDrink,
  });

  return { totalRevenue, totalRevenueFromFoodDrink };
};

export const getRevenueByPeriodAndCinema = async (
  startDate?: Date,
  endDate?: Date,
  type?: string
) => {
  // Calculate total revenue for a specific cinema within a date range
  const bookings = await prisma.booking.findMany({
    where: {
      ...(startDate && endDate
        ? { createdAt: { gte: startDate, lte: endDate } }
        : {}),
      ...(type ? { type } : {}),
    },
    select: { showtimeId: true, totalPrice: true },
  });

  if (bookings.length === 0) {
    return [];
  }

  const showtimeIds = [...new Set(bookings.map((b) => b.showtimeId))];

  const { data: showtimes } = await axios.post(
    `${process.env.SHOWTIME_SERVICE_URL}/api/showtimes/public/batch`,
    { showtimeIds }
  );

  const revenueMap: Record<string, number> = {};
  for (const booking of bookings) {
    const showtime = showtimes.find(
      (showtime: { id: string }) => showtime.id === booking.showtimeId
    );

    if (!showtime) {
      continue;
    }

    const cinemaId = showtime.cinemaId;
    revenueMap[cinemaId] = (revenueMap[cinemaId] || 0) + booking.totalPrice;
  }

  const { data: cinemas } = await axios.post(
    `${process.env.CINEMA_SERVICE_URL}/api/cinemas/public/batch`,
    { cinemaIds: Object.keys(revenueMap) }
  );

  const cinemasRevenue = Object.entries(revenueMap).map(
    ([cinemaId, totalRevenue]) => {
      const cinema = cinemas.find(
        (cinema: { id: string }) => cinema.id === cinemaId
      );

      return {
        cinema,
        totalRevenue,
      };
    }
  );

  const sortedCinemas = cinemasRevenue.sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  );

  return { sortedCinemas, cinemasRevenue };
};

export const getRevenueByPeriodAndMovie = async (
  startDate?: Date,
  endDate?: Date,
  type?: string
) => {
  // Calculate total revenue for a specific cinema within a date range
  const bookings = await prisma.booking.findMany({
    where: {
      ...(startDate && endDate
        ? { createdAt: { gte: startDate, lte: endDate } }
        : {}),
      ...(type ? { type } : {}),
    },
    select: { showtimeId: true, totalPrice: true },
  });

  if (bookings.length === 0) {
    return [];
  }

  const showtimeIds = [...new Set(bookings.map((b) => b.showtimeId))];

  const { data: showtimes } = await axios.post(
    `${process.env.SHOWTIME_SERVICE_URL}/api/showtimes/public/batch`,
    { showtimeIds }
  );

  const revenueMap: Record<string, number> = {};
  for (const booking of bookings) {
    const showtime = showtimes.find(
      (showtime: { id: string }) => showtime.id === booking.showtimeId
    );

    if (!showtime) {
      continue;
    }

    const movieId = showtime.movieId;
    revenueMap[movieId] = (revenueMap[movieId] || 0) + booking.totalPrice;
  }

  const { data: movies } = await axios.post(
    `${process.env.MOVIE_SERVICE_URL}/api/movies/public/batch`,
    { movieIds: Object.keys(revenueMap) }
  );

  const moviesRevenue = Object.entries(revenueMap).map(
    ([movieId, totalRevenue]) => {
      const movie = movies.find(
        (movie: { id: string }) => movie.id === movieId
      );

      return {
        movie,
        totalRevenue,
      };
    }
  );

  const sortedMovies = moviesRevenue.sort(
    (a, b) => b.totalRevenue - a.totalRevenue
  );

  return { sortedMovies, moviesRevenue };
};

export const getBookings = async ({
  page,
  limit,
  showtimeId,
  type,
}: {
  page?: number;
  limit?: number;
  showtimeId?: string;
  type?: string;
}) => {
  // Fetch bookings with optional filters and pagination
  const bookings = await prisma.booking.findMany({
    where: {
      ...(showtimeId ? { showtimeId } : {}),
      ...(type ? { type } : {}),
    },
    include: {
      bookingSeats: true,
      bookingFoodDrinks: true,
    },
    ...(page && limit
      ? {
          skip: (page - 1) * limit,
          take: limit,
        }
      : {}),
  });
  // Count total bookings for pagination
  const totalItems = await prisma.booking.count({
    where: {
      ...(showtimeId ? { showtimeId } : {}),
      ...(type ? { type } : {}),
    },
  });

  logger.info("Fetched bookings", {
    bookings,
    totalItems,
  });

  return {
    bookings,
    totalItems,
    totalPages: limit ? Math.ceil(totalItems / limit) : 1,
  };
};

export const deleteBookingById = async (
  redisClient: any,
  bookingId: string
) => {
  return await prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        bookingSeats: true,
        bookingFoodDrinks: true,
      },
    });

    if (!booking) {
      logger.warn("Booking not found for deletion", { bookingId });
      throw new CustomError("Booking not found", 404);
    }

    await tx.bookingSeat.deleteMany({
      where: { bookingId },
    });

    await tx.bookingFoodDrink.deleteMany({
      where: { bookingId },
    });

    await tx.booking.delete({
      where: { id: bookingId },
    });

    for (const seat of booking.bookingSeats) {
      await redisClient.publish(
        "seat-update-channel",
        JSON.stringify({
          showtimeId: booking.showtimeId,
          seatId: seat.seatId,
          status: "released",
          expiresAt: null,
        })
      );

      await redisClient.del(`hold:${booking.showtimeId}:${seat.seatId}`);
    }

    logger.info("Booking deleted successfully", { bookingId });

    return { success: true };
  });
};
