import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import logger from "../utils/logger.js";
import axios from "axios";

export const getShowtimes = async ({
  page = 1,
  limit = 10,
  movieId,
  cinemaId,
}: {
  page?: number;
  limit?: number;
  movieId?: string;
  cinemaId?: string;
}) => {
  // Fetch showtimes with pagination and filters
  const where: any = {};
  if (movieId) {
    where.movieId = movieId;
  }
  if (cinemaId) {
    where.cinemaId = cinemaId;
  }
  const showtimes = await prisma.showtime.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
  });
  // Count total items for pagination
  const totalItems = await prisma.showtime.count({ where });

  logger.info("Fetched showtimes", { showtimes, totalItems, page, limit });
  return {
    showtimes,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getShowtimeById = async (showtimeId: string) => {
  // Fetch a single showtime by ID
  const showtime = await prisma.showtime.findUnique({
    where: { id: showtimeId },
  });
  // If showtime not found, throw an error
  if (!showtime) {
    logger.warn("Showtime not found", { showtimeId });
    throw new CustomError("Showtime not found", 404);
  }
  logger.info("Fetched showtime", { showtime });
  return showtime;
};

export const createShowtime = async (
  movieId: string,
  roomId: string,
  startTime: Date,
  endTime: Date,
  price: number,
  language: string,
  subtitle: boolean,
  format: string
) => {
  // Check if the showtime overlaps with existing showtimes
  const existingShowtime = await prisma.showtime.findFirst({
    where: {
      roomId,
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  });
  if (existingShowtime) {
    logger.warn("Showtime conflict", { existingShowtime });
    throw new CustomError("Showtime conflict", 409);
  }
  // Check if the room exists
  let room;
  try {
    room = await axios.get(`${process.env.CINEMA_SERVICE_URL}/api/v1/rooms/${roomId}`);
  } catch (error: any) {
    if (error?.response && error?.response?.status === 404) {
      logger.warn("Room not found", { roomId });
      throw new CustomError("Room not found", 404);
    }
    logger.error("Failed to fetch room", { roomId, error });
    throw new CustomError("Failed to fetch room", 500);
  }
  // Create the showtime
  const showtime = await prisma.showtime.create({
    data: {
      movieId,
      roomId,
      cinemaId: room.data.data.cinemaId,
      startTime,
      endTime,
      price,
      language,
      subtitle,
      format,
    },
  });
  logger.info("Created showtime", { showtime });
  return showtime;
};

export const updateShowtimeById = async (
  showtimeId: string,
  data: {
    movieId?: string;
    roomId?: string;
    startTime?: Date;
    endTime?: Date;
    price?: number;
    language?: string;
    subtitle?: boolean;
    format?: string;
  }
) => {
  const updateShowtime: any = {};
  if (data.movieId) {
    updateShowtime.movieId = data.movieId;
  }
  if (data.roomId) {
    updateShowtime.roomId = data.roomId;
    // Check if the new room exists
    let room;
    try {
      room = await axios.get(
        `${process.env.CINEMA_SERVICE_URL}/${data.roomId}`
      );
    } catch (error: any) {
      if (error?.response && error?.response?.status === 404) {
        logger.warn("Room not found for update", { roomId: data.roomId });
        throw new CustomError("Room not found", 404);
      }
      logger.error("Failed to fetch room for update", {
        roomId: data.roomId,
        error,
      });
      throw new CustomError("Failed to fetch room", 500);
    }
    updateShowtime.cinemaId = room.data.cinemaId;
  }
  if (data.startTime) {
    updateShowtime.startTime = data.startTime;
  }
  if (data.endTime) {
    updateShowtime.endTime = data.endTime;
  }
  if (data.price) {
    updateShowtime.price = data.price;
  }
  if (data.language) {
    updateShowtime.language = data.language;
  }
  if (data.subtitle !== undefined) {
    updateShowtime.subtitle = data.subtitle;
  }
  if (data.format) {
    updateShowtime.format = data.format;
  }
  // Update the showtime
  const showtime = await prisma.showtime.update({
    where: { id: showtimeId },
    data: updateShowtime,
  });
  logger.info("Updated showtime", { showtime });
  return showtime;
};

export const archiveShowtimeById = async (showtimeId: string) => {
  // Archive the showtime by setting isActive to false
  const showtime = await prisma.showtime.update({
    where: { id: showtimeId },
    data: { isActive: false },
  });
  if (!showtime) {
    logger.warn("Showtime not found for archiving", { showtimeId });
    throw new CustomError("Showtime not found", 404);
  }
  logger.info("Archived showtime", { showtime });
  return { message: "Showtime archived successfully" };
};

export const restoreShowtimeById = async (showtimeId: string) => {
  // Restore the showtime by setting isActive to true
  const showtime = await prisma.showtime.update({
    where: { id: showtimeId },
    data: { isActive: true },
  });
  if (!showtime) {
    logger.warn("Showtime not found for restoring", { showtimeId });
    throw new CustomError("Showtime not found", 404);
  }
  logger.info("Restored showtime", { showtime });
  return { message: "Showtime restored successfully" };
};
