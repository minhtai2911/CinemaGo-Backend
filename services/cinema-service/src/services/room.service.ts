import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import logger from "../utils/logger.js";
import axios from "axios";

type Seat = {
  row: string;
  col: number;
  type: string;
};

export const getRooms = async ({
  page,
  limit,
  search = "",
  isActive,
  startTime,
  endTime,
  cinemaId,
}: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  startTime?: Date;
  endTime?: Date;
  cinemaId?: string;
}) => {
  let response;
  if (startTime && endTime) {
    response = await axios.get(
      `${process.env.SHOWTIME_SERVICE_URL}/api/showtimes/public/get-busy-rooms`,
      {
        params: {
          startTime,
          endTime,
          ...(cinemaId && { cinemaId }),
        },
      }
    );
  }
  // Fetch rooms with pagination and search functionality
  const rooms = await prisma.room.findMany({
    where: {
      name: {
        contains: search,
        mode: "insensitive",
      },
      ...(isActive && { isActive }),
      ...(cinemaId && { cinemaId }),
      ...(startTime &&
        endTime && {
          id: {
            notIn: response?.data?.data || [],
          },
        }),
    },
    ...(page && limit
      ? {
          skip: (page - 1) * limit,
          take: limit,
        }
      : {}),
  });
  // Count total items for pagination
  const totalItems = await prisma.room.count({
    where: {
      name: {
        contains: search,
        mode: "insensitive",
      },
      ...(isActive && { isActive }),
      ...(cinemaId && { cinemaId }),
      ...(startTime &&
        endTime && {
          id: {
            notIn: response?.data?.data || [],
          },
        }),
    },
  });
  return {
    rooms,
    totalItems,
    totalPages: limit ? Math.ceil(totalItems / limit) : 1,
  };
};

export const getRoomById = async (roomId: string) => {
  // Fetch a room by its ID
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      seats: true,
    },
  });
  // If room not found, throw a custom error
  if (!room) {
    logger.warn("Room not found", { roomId });
    throw new CustomError("Room not found", 404);
  }

  const seatTypePriceMap: { [key: string]: number } = {};
  room.seats.forEach((seat) => {
    seatTypePriceMap[seat.seatType] = seat.extraPrice;
  });

  return { ...room, ...seatTypePriceMap };
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
  name?: string,
  cinemaId?: string,
  seatLayout?: Seat[],
  vipPrice?: number,
  couplePrice?: number
) => {
  // Calculate total seats from the seat layout
  let totalSeats = 0;
  if (seatLayout && seatLayout.length > 0) {
    for (const seat of seatLayout) {
      if (seat.type !== "EMPTY") {
        totalSeats++;
      }
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
  if (seatLayout && seatLayout.length > 0) {
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
  }
  logger.info("Updated room", { updatedRoom });
  return updatedRoom;
};

export const archiveRoomById = async (roomId: string) => {
  // Archive a room by its ID
  const archivedRoom = await prisma.room.update({
    where: { id: roomId },
    data: { isActive: false },
  });
  // If room not found, throw a custom error
  if (!archivedRoom) {
    logger.warn("Room not found for archiving", { roomId });
    throw new CustomError("Room not found", 404);
  }
  logger.info("Archived room", { archivedRoom });
  return { message: "Room archived successfully" };
};

export const restoreRoomById = async (roomId: string) => {
  // Restore a room by its ID
  const restoredRoom = await prisma.room.update({
    where: { id: roomId },
    data: { isActive: true },
  });
  // If room not found, throw a custom error
  if (!restoredRoom) {
    logger.warn("Room not found for restoration", { roomId });
    throw new CustomError("Room not found", 404);
  }
  logger.info("Restored room", { restoredRoom });
  return { message: "Room restored successfully" };
};

export const holdSeat = async (
  redisClient: any,
  userId: string,
  showtimeId: string,
  seatId: string
) => {
  const key = `hold:${showtimeId}:${seatId}`;
  const seat = await prisma.seat.findUnique({ where: { id: seatId } });

  if (!seat) {
    throw new CustomError("Seat not found", 404);
  }

  const result = await redisClient.set(
    key,
    JSON.stringify({
      userId,
      showtimeId,
      seatId,
      extraPrice: seat.extraPrice || 0,
    }),
    "NX",
    "EX",
    300 // 5 minutes
  );

  if (result !== "OK") {
    throw new CustomError("Seat already held", 409);
  }

  return { message: "Seats held successfully" };
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
