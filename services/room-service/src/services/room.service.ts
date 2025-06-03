import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import logger from "../utils/logger.js";

type Seat = {
  row: string;
  number: number;
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
  const room = await prisma.room.findUnique({
    where: { id: roomId },
  });
  if (!room) {
    logger.warn("Room not found", { roomId });
    throw new CustomError("Room not found", 404);
  }
  return room;
};

export const createRoom = async (
  name: string,
  cinemaId: string,
  seatLayout: Seat[]
) => {
  const existingRoom = await prisma.room.findFirst({
    where: { name, cinemaId },
  });
  if (existingRoom) {
    logger.warn("Room already exists", { name, cinemaId });
    throw new CustomError("Room already exists", 409);
  }
  const room = await prisma.room.create({
    data: { name, cinemaId, totalSeats: seatLayout.length, seatLayout },
  });
  logger.info("Created room", { room });
  return room;
};

export const updateRoomById = async (
  roomId: string,
  name: string,
  cinemaId: string,
  seatLayout: Seat[]
) => {
  const updatedRoom = await prisma.room.update({
    where: { id: roomId },
    data: { name, cinemaId, totalSeats: seatLayout.length, seatLayout },
  });
  if (!updatedRoom) {
    logger.warn("Room not found for update", { roomId });
    throw new CustomError("Room not found", 404);
  }
  logger.info("Updated room", { updatedRoom });
  return updatedRoom;
};

export const deleteRoomById = async (roomId: string) => {
  const deletedRoom = await prisma.room.delete({
    where: { id: roomId },
  });
  if (!deletedRoom) {
    logger.warn("Room not found for deletion", { roomId });
    throw new CustomError("Room not found", 404);
  }
  logger.info("Deleted room", { deletedRoom });
  return { message: "Room deleted successfully" };
};
