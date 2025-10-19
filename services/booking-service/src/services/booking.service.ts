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
  foodDrinks: { foodDrinkId: string; quantity: number }[]
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
      `${process.env.FOOD_DRINK_SERVICE_URL}/api/food_drinks/public/by-ids`,
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
      },
      include: {
        bookingSeats: true,
        bookingFoodDrinks: true,
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
