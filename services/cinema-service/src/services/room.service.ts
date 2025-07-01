import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import logger from "../utils/logger.js";

type Seat = {
  row: string;
  col: number;
  type: string;
};

export const getRooms = async ({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  // Fetch rooms with pagination and search functionality
  const rooms = await prisma.room.findMany({
    where: {
      name: {
        contains: search,
        mode: "insensitive",
      },
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  // Count total items for pagination
  const totalItems = await prisma.room.count({
    where: {
      name: {
        contains: search,
        mode: "insensitive",
      },
    },
  });
  return {
    rooms,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getRoomById = async (roomId: string) => {
  // Fetch a room by its ID
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      Seat: true,
    },
  });
  // If room not found, throw a custom error
  if (!room) {
    logger.warn("Room not found", { roomId });
    throw new CustomError("Room not found", 404);
  }
  return room;
};

export const createRoom = async (
  name: string,
  cinemaId: string,
  seatLayout: Seat[],
  vipPrice: number,
  couplePrice: number
) => {
  // Check if the room already exists
  const existingRoom = await prisma.room.findFirst({
    where: { name, cinemaId },
  });
  // If room exists, throw a custom error
  if (existingRoom) {
    logger.warn("Room already exists", { name, cinemaId });
    throw new CustomError("Room already exists", 409);
  }
  // Calculate total seats from the seat layout
  let totalSeats = 0;
  for (const seat of seatLayout) {
    if (seat.type !== "EMPTY") {
      totalSeats++;
    }
  }
  // Create a new room
  const room = await prisma.room.create({
    data: { name, cinemaId, totalSeats, seatLayout },
  });
  // Create seat entries in the database
  const seatEntries = seatLayout
    .filter((seat) => seat.type !== "EMPTY")
    .map((seat) => {
      return {
        roomId: room.id,
        seatNumber: `${seat.row}${seat.col}`,
        seatType: seat.type,
        extraPrice:
          seat.type === "VIP"
            ? vipPrice
            : seat.type === "COUPLE"
            ? couplePrice
            : 0,
      };
    });
  await prisma.seat.createMany({
    data: seatEntries,
  });
  logger.info("Created room", { room });
  return room;
};

export const updateRoomById = async (
  roomId: string,
  name: string,
  cinemaId: string,
  seatLayout: Seat[],
  vipPrice: number,
  couplePrice: number
) => {
  // Calculate total seats from the seat layout
  let totalSeats = 0;
  for (const seat of seatLayout) {
    if (seat.type !== "EMPTY") {
      totalSeats++;
    }
  }
  // Update a room by its ID
  const updatedRoom = await prisma.room.update({
    where: { id: roomId },
    data: { name, cinemaId, totalSeats, seatLayout },
  });
  // If room not found, throw a custom error
  if (!updatedRoom) {
    logger.warn("Room not found for update", { roomId });
    throw new CustomError("Room not found", 404);
  }
  // Update seat entries in the database
  const seatEntries = seatLayout
    .filter((seat) => seat.type !== "EMPTY")
    .map((seat) => {
      return {
        roomId: updatedRoom.id,
        seatNumber: `${seat.row}${seat.col}`,
        seatType: seat.type,
        extraPrice:
          seat.type === "VIP"
            ? vipPrice
            : seat.type === "COUPLE"
            ? couplePrice
            : 0,
      };
    });
  await prisma.seat.deleteMany({
    where: { roomId: updatedRoom.id },
  });
  await prisma.seat.createMany({
    data: seatEntries,
  });
  logger.info("Updated room", { updatedRoom });
  return updatedRoom;
};

export const deleteRoomById = async (roomId: string) => {
  // Delete a room by its ID
  const deletedRoom = await prisma.room.delete({
    where: { id: roomId },
  });
  // If room not found, throw a custom error
  if (!deletedRoom) {
    logger.warn("Room not found for deletion", { roomId });
    throw new CustomError("Room not found", 404);
  }
  logger.info("Deleted room", { deletedRoom });
  return { message: "Room deleted successfully" };
};

export const holdSeat = async (
  redisClient: any,
  userId: string,
  showtimeId: string,
  seatId: string
) => {
  const key = `hold:${showtimeId}:${seatId}`;
  const existingHold = await redisClient.get(key);
  // If seats are already held, throw a custom error
  if (existingHold) {
    logger.warn("Seats already held", { showtimeId, seatId });
    throw new CustomError("Seats already held", 409);
  }
  const seat = await prisma.seat.findUnique({
    where: { id: seatId },
  });
  // If seat not found, throw a custom error
  if (!seat) {
    logger.warn("Seat not found", { seatId });
    throw new CustomError("Seat not found", 404);
  }
  // Set the hold in Redis with a 5-minute expiration
  await redisClient.setex(
    key,
    300,
    JSON.stringify({
      userId,
      showtimeId,
      seatId,
      extraPrice: seat?.extraPrice || 0,
    })
  );
  logger.info("Held seats", {
    userId,
    showtimeId,
    seatId,
    extraPrice: seat?.extraPrice || 0,
  });
  return {
    message: "Seats held successfully",
  };
};

export const getHeldSeats = async (redisClient: any, showtimeId: string) => {
  const keys = await redisClient.keys(`hold:${showtimeId}:*`);
  const holds = await Promise.all(
    keys.map(async (key: string) => {
      const holdData = await redisClient.get(key);
      return JSON.parse(holdData);
    })
  );
  logger.info("Fetched held seats", { showtimeId, holds });
  return holds;
};
