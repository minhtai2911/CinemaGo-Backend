import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import axios from "axios";

export const getBookingsByUserId = async ({
  userId,
  page,
  limit,
  status,
}: {
  userId: string;
  page?: number;
  limit?: number;
  status: string;
}) => {
  // Fetch bookings for a specific user with pagination
  const bookings = await prisma.booking.findMany({
    where: {
      userId,
      status,
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
    orderBy: { createdAt: "desc" },
  });
  // Count total bookings for pagination
  const totalItems = await prisma.booking.count({
    where: {
      userId,
      ...(status ? { status } : {}),
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
  cinemaId: string,
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
        cinemaId,
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
    where: { showtimeId, booking: { status: "Đã thanh toán" } },
  });

  logger.info("Fetched booking seats for showtime", {
    showtimeId,
    bookingSeats,
  });
  return bookingSeats;
};

export const getRevenueByPeriod = async (
  startDate?: Date,
  endDate?: Date,
  type?: string,
  cinemaId?: string
) => {
  const where = {
    status: "Đã thanh toán",
    ...(startDate && endDate
      ? { createdAt: { gte: startDate, lte: endDate } }
      : {}),
    ...(type ? { type } : {}),
    ...(cinemaId ? { cinemaId } : {}),
  };

  const bookings = await prisma.booking.findMany({
    where: where,
    select: {
      createdAt: true,
      totalPrice: true,
      bookingFoodDrinks: {
        select: {
          totalPrice: true,
        },
      },
    },
  });

  const getVietnamDateKey = (utcDate: Date): string => {
    const vietnamOffset = 7 * 60;
    const vietnamTime = new Date(utcDate.getTime() + vietnamOffset * 60 * 1000);
    return vietnamTime.toISOString().split("T")[0];
  };

  const dailyMap = new Map<
    string,
    {
      totalRevenue: number;
      totalFoodDrinkRevenue: number;
      totalTicketRevenue: number;
    }
  >();

  for (const booking of bookings) {
    if (!booking.createdAt) {
      continue;
    }

    const dayKey = getVietnamDateKey(booking.createdAt);

    const foodRevenue =
      booking.bookingFoodDrinks?.reduce(
        (sum, fd) => sum + (fd.totalPrice ?? 0),
        0
      ) ?? 0;

    const totalRevenue = booking.totalPrice ?? 0;
    const ticketRevenue = totalRevenue - foodRevenue;

    if (!dailyMap.has(dayKey)) {
      dailyMap.set(dayKey, {
        totalRevenue: 0,
        totalFoodDrinkRevenue: 0,
        totalTicketRevenue: 0,
      });
    }

    const dayData = dailyMap.get(dayKey)!;
    dayData.totalRevenue += totalRevenue;
    dayData.totalFoodDrinkRevenue += foodRevenue;
    dayData.totalTicketRevenue += ticketRevenue;
  }

  const dailyRevenues = Array.from(dailyMap.entries())
    .map(([date, data]) => ({
      date,
      totalTicketRevenue: data.totalTicketRevenue,
      totalFoodDrinkRevenue: data.totalFoodDrinkRevenue,
      totalRevenue: data.totalRevenue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const totalTicketRevenue = dailyRevenues.reduce(
    (sum, d) => sum + d.totalTicketRevenue,
    0
  );
  const totalFoodDrinkRevenue = dailyRevenues.reduce(
    (sum, d) => sum + d.totalFoodDrinkRevenue,
    0
  );
  const totalRevenue = dailyRevenues.reduce(
    (sum, d) => sum + d.totalRevenue,
    0
  );

  const summary = {
    totalTicketRevenue,
    totalFoodDrinkRevenue,
    totalRevenue,
  };

  logger.info("Revenue by period calculated (daily breakdown - Vietnam time)", {
    startDate,
    endDate,
    type,
    cinemaId,
    totalTicketRevenue,
    totalFoodDrinkRevenue,
    totalRevenue,
    daysCount: dailyRevenues.length,
  });

  return {
    daily: dailyRevenues,
    summary,
  };
};

export const getRevenueAndOccupancyByCinema = async (
  startDate?: Date,
  endDate?: Date,
  type?: string,
  cinemaId?: string
) => {
  const whereBooking = {
    ...(startDate && endDate
      ? { createdAt: { gte: startDate, lte: endDate } }
      : {}),
    ...(type ? { type } : {}),
    status: "Đã thanh toán",
    ...(cinemaId ? { cinemaId } : {}),
  };

  const bookings = await prisma.booking.findMany({
    where: whereBooking,
    select: {
      createdAt: true,
      showtimeId: true,
      totalPrice: true,
      bookingSeats: { select: { seatId: true } },
      bookingFoodDrinks: { select: { totalPrice: true } },
    },
  });

  if (bookings.length === 0) {
    return {
      cinemasRevenue: [],
      sortedCinemas: [],
      dailyBreakdownByCinema: new Map(),
    };
  }

  const showtimeIds = [...new Set(bookings.map((b) => b.showtimeId))];

  const {
    data: { data: showtimes },
  } = await axios.post(
    `${process.env.SHOWTIME_SERVICE_URL}/api/showtimes/public/batch`,
    { showtimeIds }
  );

  const showtimeMap = new Map<string, { cinemaId: string; roomId: string }>(
    showtimes.map((s: any) => [
      s.id,
      { cinemaId: s.cinemaId, roomId: s.roomId },
    ])
  );

  const cinemaStats = new Map<
    string,
    {
      revenue: number;
      foodDrinkRevenue: number;
      bookedSeats: number;
    }
  >();

  const dailyBreakdownByCinema = new Map<
    string,
    Map<
      string,
      {
        revenue: number;
        foodDrinkRevenue: number;
        bookedSeats: number;
      }
    >
  >();

  const getVietnamDateKey = (utcDate: Date): string => {
    const vietnamOffset = 7 * 60 * 60 * 1000;
    const vnTime = new Date(utcDate.getTime() + vietnamOffset);
    return vnTime.toISOString().split("T")[0];
  };

  for (const booking of bookings) {
    const showtimeInfo = showtimeMap.get(booking.showtimeId);
    if (!showtimeInfo) continue;

    const cid = showtimeInfo.cinemaId;
    if (cinemaId && cid !== cinemaId) continue;

    const fnbRevenue = booking.bookingFoodDrinks.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );

    const seatCount = booking.bookingSeats.length;

    const totalCurrent = cinemaStats.get(cid) || {
      revenue: 0,
      foodDrinkRevenue: 0,
      bookedSeats: 0,
    };
    cinemaStats.set(cid, {
      revenue: totalCurrent.revenue + booking.totalPrice,
      foodDrinkRevenue: totalCurrent.foodDrinkRevenue + fnbRevenue,
      bookedSeats: totalCurrent.bookedSeats + seatCount,
    });

    if (booking.createdAt) {
      const dayKey = getVietnamDateKey(booking.createdAt);

      if (!dailyBreakdownByCinema.has(cid)) {
        dailyBreakdownByCinema.set(cid, new Map());
      }
      const dayMap = dailyBreakdownByCinema.get(cid)!;

      const dayCurrent = dayMap.get(dayKey) || {
        revenue: 0,
        foodDrinkRevenue: 0,
        bookedSeats: 0,
      };
      dayMap.set(dayKey, {
        revenue: dayCurrent.revenue + booking.totalPrice,
        foodDrinkRevenue: dayCurrent.foodDrinkRevenue + fnbRevenue,
        bookedSeats: dayCurrent.bookedSeats + seatCount,
      });
    }
  }

  const roomIds = [...new Set(showtimes.map((s: any) => s.roomId))];

  const {
    data: { data: rooms },
  } = await axios.post(
    `${process.env.CINEMA_SERVICE_URL}/api/rooms/public/batch`,
    { roomIds }
  );

  const roomSeatCount = new Map(
    rooms.map((r: any) => [r.id, r.totalSeats || 0])
  );

  const totalSeatsByCinema = new Map<string, number>();
  for (const showtime of showtimes) {
    const cid = showtime.cinemaId;
    if (cinemaId && cid !== cinemaId) continue;

    const totalSeats = roomSeatCount.get(showtime.roomId) || 0;
    totalSeatsByCinema.set(
      cid,
      (totalSeatsByCinema.get(cid) || 0) + Number(totalSeats)
    );
  }

  const targetCinemaIds = cinemaId
    ? [cinemaId].filter((id) => cinemaStats.has(id))
    : [...cinemaStats.keys()];

  if (targetCinemaIds.length === 0) {
    return {
      cinemasRevenue: [],
      sortedCinemas: [],
      dailyBreakdownByCinema: new Map(),
    };
  }

  const {
    data: { data: cinemas },
  } = await axios.post(
    `${process.env.CINEMA_SERVICE_URL}/api/cinemas/public/batch`,
    { cinemaIds: targetCinemaIds }
  );

  const cinemaMap = new Map(cinemas.map((c: any) => [c.id, c]));

  const formattedDailyBreakdown = new Map<
    string,
    Array<{
      date: string;
      totalRevenue: number;
      foodDrinkRevenue: number;
      ticketRevenue: number;
      bookedSeats: number;
      totalSeats: number;
      occupancyRate: number;
    }>
  >();

  targetCinemaIds.forEach((cid) => {
    const dayMap = dailyBreakdownByCinema.get(cid);
    const totalSeatsAllDays = totalSeatsByCinema.get(cid) || 1;

    if (!dayMap) return;

    const dailyArray = Array.from(dayMap.entries())
      .map(([date, stats]) => {
        const occupancyRate =
          totalSeatsAllDays > 0
            ? (stats.bookedSeats / totalSeatsAllDays) * 100
            : 0;

        return {
          date,
          totalRevenue: stats.revenue,
          foodDrinkRevenue: stats.foodDrinkRevenue,
          ticketRevenue: stats.revenue - stats.foodDrinkRevenue,
          bookedSeats: stats.bookedSeats,
          totalSeats: totalSeatsAllDays,
          occupancyRate: Number(occupancyRate.toFixed(2)),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    formattedDailyBreakdown.set(cid, dailyArray);
  });

  const result = targetCinemaIds.map((cid) => {
    const stats = cinemaStats.get(cid)!;
    const totalSeats = totalSeatsByCinema.get(cid) || 1;
    const occupancyRate = (stats.bookedSeats / totalSeats) * 100;

    return {
      cinema: cinemaMap.get(cid),
      totalRevenue: stats.revenue,
      foodDrinkRevenue: stats.foodDrinkRevenue,
      ticketRevenue: stats.revenue - stats.foodDrinkRevenue,
      bookedSeats: stats.bookedSeats,
      totalSeats,
      occupancyRate: Number(occupancyRate.toFixed(2)),
      dailyBreakdown: formattedDailyBreakdown.get(cid) || [],
    };
  });

  const sorted = [...result].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return sorted;
};

export const getRevenueAndOccupancyByMovie = async (
  startDate?: Date,
  endDate?: Date,
  type?: string,
  cinemaId?: string
) => {
  const whereBooking = {
    ...(startDate && endDate
      ? { createdAt: { gte: startDate, lte: endDate } }
      : {}),
    ...(type ? { type } : {}),
    status: "Đã thanh toán",
    ...(cinemaId ? { cinemaId } : {}),
  };

  const bookings = await prisma.booking.findMany({
    where: whereBooking,
    select: {
      createdAt: true,
      showtimeId: true,
      totalPrice: true,
      bookingSeats: { select: { seatId: true } },
      bookingFoodDrinks: { select: { totalPrice: true } },
    },
  });

  if (bookings.length === 0) {
    return {
      moviesRevenue: [],
      sortedMovies: [],
      dailyBreakdownByMovie: new Map(),
    };
  }

  const showtimeIds = [...new Set(bookings.map((b) => b.showtimeId))];

  const {
    data: { data: showtimes },
  } = await axios.post(
    `${process.env.SHOWTIME_SERVICE_URL}/api/showtimes/public/batch`,
    { showtimeIds }
  );

  const filteredShowtimes = cinemaId
    ? showtimes.filter((s: any) => s.cinemaId === cinemaId)
    : showtimes;

  const showtimeMap = new Map<string, { movieId: string; roomId: string }>(
    filteredShowtimes.map((s: any) => [
      s.id,
      { movieId: s.movieId, roomId: s.roomId },
    ])
  );

  const movieStats = new Map<
    string,
    {
      revenue: number;
      foodDrinkRevenue: number;
      bookedSeats: number;
    }
  >();

  const dailyBreakdownByMovie = new Map<
    string,
    Map<
      string,
      {
        revenue: number;
        foodDrinkRevenue: number;
        bookedSeats: number;
      }
    >
  >();

  const getVietnamDateKey = (utcDate: Date): string => {
    const vietnamOffset = 7 * 60 * 60 * 1000;
    const vnTime = new Date(utcDate.getTime() + vietnamOffset);
    return vnTime.toISOString().split("T")[0];
  };

  for (const booking of bookings) {
    const info = showtimeMap.get(booking.showtimeId);
    if (!info) continue;

    const { movieId } = info;

    const fnbRevenue = booking.bookingFoodDrinks.reduce(
      (sum, item) => sum + item.totalPrice,
      0
    );
    const seatCount = booking.bookingSeats.length;

    const totalCurrent = movieStats.get(movieId) || {
      revenue: 0,
      foodDrinkRevenue: 0,
      bookedSeats: 0,
    };
    movieStats.set(movieId, {
      revenue: totalCurrent.revenue + booking.totalPrice,
      foodDrinkRevenue: totalCurrent.foodDrinkRevenue + fnbRevenue,
      bookedSeats: totalCurrent.bookedSeats + seatCount,
    });

    if (booking.createdAt) {
      const dayKey = getVietnamDateKey(booking.createdAt);

      if (!dailyBreakdownByMovie.has(movieId)) {
        dailyBreakdownByMovie.set(movieId, new Map());
      }
      const dayMap = dailyBreakdownByMovie.get(movieId)!;

      const dayCurrent = dayMap.get(dayKey) || {
        revenue: 0,
        foodDrinkRevenue: 0,
        bookedSeats: 0,
      };
      dayMap.set(dayKey, {
        revenue: dayCurrent.revenue + booking.totalPrice,
        foodDrinkRevenue: dayCurrent.foodDrinkRevenue + fnbRevenue,
        bookedSeats: dayCurrent.bookedSeats + seatCount,
      });
    }
  }

  const roomIds = [...new Set(filteredShowtimes.map((s: any) => s.roomId))];

  const {
    data: { data: rooms },
  } = await axios.post(
    `${process.env.CINEMA_SERVICE_URL}/api/rooms/public/batch`,
    { roomIds }
  );

  const roomSeatCount = new Map(
    rooms.map((r: any) => [r.id, r.totalSeats || 0])
  );

  const totalSeatsByMovie = new Map<string, number>();
  for (const showtime of filteredShowtimes) {
    const totalSeats = roomSeatCount.get(showtime.roomId) || 0;
    totalSeatsByMovie.set(
      showtime.movieId,
      (totalSeatsByMovie.get(showtime.movieId) || 0) + Number(totalSeats)
    );
  }

  const movieIds = [...movieStats.keys()];
  if (movieIds.length === 0) {
    return {
      moviesRevenue: [],
      sortedMovies: [],
      dailyBreakdownByMovie: new Map(),
    };
  }

  const {
    data: { data: movies },
  } = await axios.post(
    `${process.env.MOVIE_SERVICE_URL}/api/movies/public/batch`,
    { movieIds }
  );

  const movieMap = new Map(movies.map((m: any) => [m.id, m]));

  const formattedDailyBreakdown = new Map<
    string,
    Array<{
      date: string;
      totalRevenue: number;
      foodDrinkRevenue: number;
      ticketRevenue: number;
      bookedSeats: number;
      totalSeats: number;
      occupancyRate: number;
    }>
  >();

  movieIds.forEach((movieId) => {
    const dayMap = dailyBreakdownByMovie.get(movieId);
    const totalSeatsAllDays = totalSeatsByMovie.get(movieId) || 1;

    if (!dayMap) return;

    const dailyArray = Array.from(dayMap.entries())
      .map(([date, stats]) => {
        const occupancyRate =
          totalSeatsAllDays > 0
            ? (stats.bookedSeats / totalSeatsAllDays) * 100
            : 0;

        return {
          date,
          totalRevenue: stats.revenue,
          foodDrinkRevenue: stats.foodDrinkRevenue,
          ticketRevenue: stats.revenue - stats.foodDrinkRevenue,
          bookedSeats: stats.bookedSeats,
          totalSeats: totalSeatsAllDays,
          occupancyRate: Number(occupancyRate.toFixed(2)),
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));

    formattedDailyBreakdown.set(movieId, dailyArray);
  });

  const result = movieIds.map((movieId) => {
    const stats = movieStats.get(movieId)!;
    const totalSeats = totalSeatsByMovie.get(movieId) || 1;
    const occupancyRate = (stats.bookedSeats / totalSeats) * 100;

    return {
      movie: movieMap.get(movieId),
      totalRevenue: stats.revenue,
      foodDrinkRevenue: stats.foodDrinkRevenue,
      ticketRevenue: stats.revenue - stats.foodDrinkRevenue,
      bookedSeats: stats.bookedSeats,
      totalSeats,
      occupancyRate: Number(occupancyRate.toFixed(2)),
      dailyBreakdown: formattedDailyBreakdown.get(movieId) || [],
    };
  });

  const sorted = [...result].sort((a, b) => b.totalRevenue - a.totalRevenue);

  return sorted;
};

export const getBookings = async ({
  page,
  limit,
  showtimeId,
  cinemaId,
  type,
  status,
}: {
  page?: number;
  limit?: number;
  showtimeId?: string;
  cinemaId?: string;
  type?: string;
  status?: string;
}) => {
  // Fetch bookings with optional filters and pagination
  const bookings = await prisma.booking.findMany({
    where: {
      ...(showtimeId ? { showtimeId } : {}),
      ...(type ? { type } : {}),
      ...(cinemaId ? { cinemaId } : {}),
      ...(status ? { status } : {}),
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
    orderBy: { createdAt: "desc" },
  });
  // Count total bookings for pagination
  const totalItems = await prisma.booking.count({
    where: {
      ...(showtimeId ? { showtimeId } : {}),
      ...(type ? { type } : {}),
      ...(cinemaId ? { cinemaId } : {}),
      ...(status ? { status } : {}),
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

export const updateBookingStatus = async (
  redisClient: any,
  bookingId: string,
  status: string,
  paymentMethod: string
) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      bookingSeats: true,
    },
  });

  if (!booking) {
    logger.warn("Booking not found for status update", { bookingId });
    throw new CustomError("Booking not found", 404);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status,
      paymentMethod,
    },
  });

  if (status === "Thanh toán thất bại") {
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
  }

  if (status === "Đã thanh toán") {
    for (const seat of booking.bookingSeats) {
      await redisClient.publish(
        "seat-update-channel",
        JSON.stringify({
          showtimeId: booking.showtimeId,
          seatId: seat.seatId,
          status: "booked",
          expiresAt: null,
        })
      );

      await redisClient.del(`hold:${booking.showtimeId}:${seat.seatId}`);
    }
  }

  logger.info("Booking status updated successfully", {
    bookingId,
    status,
    paymentMethod,
  });

  return updatedBooking;
};

export const getPeakHoursInMonth = async (
  month: number,
  year: number,
  cinemaId?: string,
  type?: string
) => {
  if (month < 1 || month > 12) {
    logger.warn("Invalid month for peak hours report", { month, year });
    throw new CustomError("Tháng không hợp lệ. Phải từ 1 đến 12.", 400);
  }

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  endDate.setHours(23, 59, 59, 999);

  const where = {
    status: "Đã thanh toán",
    ...(type ? { type } : {}),
    ...(cinemaId ? { cinemaId } : {}),
    createdAt: {
      gte: startDate,
      lte: endDate,
    },
  };

  const bookings = await prisma.booking.findMany({
    where: where,
    select: {
      showtimeId: true,
      bookingSeats: {
        select: { id: true },
      },
    },
  });

  if (bookings.length === 0) {
    const emptyHours = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      formattedHour: `${i.toString().padStart(2, "0")}:00`,
      ticketCount: 0,
    }));

    return {
      period: {
        month,
        year,
        display: `Tháng ${month}/${year}`,
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
      },
      filters: {
        cinemaId: cinemaId || "Tất cả rạp",
        type: type || "Tất cả định dạng",
      },
      summary: {
        totalTickets: 0,
        totalBookings: 0,
      },
      topPeakHour: null,
      top5PeakHours: [],
      peakHours: [],
      allHours: emptyHours,
    };
  }

  const showtimeIds = [...new Set(bookings.map((b) => b.showtimeId))];

  const {
    data: { data: showtimes },
  } = await axios.post(
    `${process.env.SHOWTIME_SERVICE_URL}/api/showtimes/public/batch`,
    { showtimeIds }
  );

  const showtimeStartMap = new Map<string, Date>();
  for (const st of showtimes) {
    if (st.id && st.startTime) {
      showtimeStartMap.set(st.id, new Date(st.startTime));
    }
  }

  const hourlyCount = Array(24).fill(0);

  for (const booking of bookings) {
    const startTime = showtimeStartMap.get(booking.showtimeId);

    if (!startTime) {
      continue;
    }

    const hour = (startTime.getHours() + 7) % 24;
    hourlyCount[hour] += booking.bookingSeats.length;
  }

  const allHours = hourlyCount.map((ticketCount, hour) => ({
    hour,
    formattedHour: `${hour.toString().padStart(2, "0")}:00`,
    ticketCount,
  }));

  const peakHours = [...allHours]
    .filter((h) => h.ticketCount > 0)
    .sort((a, b) => b.ticketCount - a.ticketCount);

  const totalTickets = hourlyCount.reduce((sum, count) => sum + count, 0);
  const topPeakHour = peakHours[0] || null;

  const result = {
    period: {
      month,
      year,
      display: `Tháng ${month}/${year}`,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
    },
    filters: {
      cinemaId: cinemaId || "Tất cả rạp",
      type: type || "Tất cả định dạng",
    },
    summary: {
      totalTickets,
      totalBookings: bookings.length,
    },
    topPeakHour,
    top5PeakHours: peakHours.slice(0, 5),
    peakHours: peakHours.slice(0, 10),
    allHours,
  };

  logger.info("Peak hours in month report generated", {
    month,
    year,
    cinemaId,
    type,
    totalTickets,
    topPeakHour: topPeakHour?.formattedHour,
  });

  return result;
};

export const maskBookingAsUsed = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  });

  if (!booking) {
    logger.warn("Booking not found for masking", { bookingId });
    throw new CustomError("Booking not found", 404);
  }

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      isUsed: true,
    },
  });

  logger.info("Booking masked as used successfully", { bookingId });

  return updatedBooking;
};
