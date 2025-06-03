import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";

export const getCinemas = async ({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const cinemas = await prisma.cinema.findMany({
    where: {
      name: { contains: search, mode: "insensitive" },
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  const totalItems = await prisma.cinema.count({
    where: {
      name: { contains: search, mode: "insensitive" },
    },
  });
  logger.info("Fetched cinemas", { cinemas, totalItems, page, limit });
  return {
    cinemas,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getCinemaById = async (cinemaId: string) => {
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  if (!cinema) {
    logger.warn("Cinema not found", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  logger.info("Fetched cinema", { cinema });
  return cinema;
};

export const createCinema = async (name: string, address: string, city: string) => {
  const existingCinema = await prisma.cinema.findUnique({
    where: { name },
  });
  if (existingCinema) {
    logger.warn("Cinema already exists", { name });
    throw new CustomError("Cinema already exists", 409);
  }
  const cinema = await prisma.cinema.create({
    data: { name, address, city },
  });
  logger.info("Created cinema", { cinema });
  return cinema;
};

export const updateCinemaById = async (
  cinemaId: string,
  data: { name: string; address: string; city: string }
) => {
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  if (!cinema) {
    logger.warn("Cinema not found", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  const updatedCinema = await prisma.cinema.update({
    where: { id: cinemaId },
    data,
  });
  logger.info("Updated cinema", { updatedCinema });
  return updatedCinema;
};

export const archiveCinemaById = async (cinemaId: string) => {
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  if (!cinema) {
    logger.warn("Cinema not found for archiving", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  const archivedCinema = await prisma.cinema.update({
    where: { id: cinemaId },
    data: { isActive: false },
  });
  logger.info("Archived cinema", { archivedCinema });
  return { message: "Cinema archived successfully" };
};

export const restoreCinemaById = async (cinemaId: string) => {
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  if (!cinema) {
    logger.warn("Cinema not found for restoration", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  const restoredCinema = await prisma.cinema.update({
    where: { id: cinemaId },
    data: { isActive: true },
  });
  logger.info("Restored cinema", { restoredCinema });
  return { message: "Cinema restored successfully" };
};


