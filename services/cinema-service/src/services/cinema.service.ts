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
  // Fetch cinemas with pagination and search functionality
  const cinemas = await prisma.cinema.findMany({
    where: {
      name: { contains: search, mode: "insensitive" },
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  // Count total items for pagination
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
  // Fetch a cinema by its ID
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  // If cinema not found, throw a custom error
  if (!cinema) {
    logger.warn("Cinema not found", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  logger.info("Fetched cinema", { cinema });
  return cinema;
};

export const createCinema = async (
  name: string,
  address: string,
  city: string,
  longitude?: number,
  latitude?: number
) => {
  // Check if cinema already exists
  const existingCinema = await prisma.cinema.findUnique({
    where: { name },
  });
  if (existingCinema) {
    logger.warn("Cinema already exists", { name });
    throw new CustomError("Cinema already exists", 409);
  }
  // Create a new cinema
  const cinema = await prisma.cinema.create({
    data: { name, address, city, longitude, latitude },
  });
  logger.info("Created cinema", { cinema });
  return cinema;
};

export const updateCinemaById = async (
  cinemaId: string,
  data: {
    name?: string;
    address?: string;
    city?: string;
    longitude?: number;
    latitude?: number;
  }
) => {
  // Check if cinema exists before updating
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  if (!cinema) {
    logger.warn("Cinema not found", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  // Update the cinema with the provided data
  const updatedCinema = await prisma.cinema.update({
    where: { id: cinemaId },
    data,
  });
  logger.info("Updated cinema", { updatedCinema });
  return updatedCinema;
};

export const archiveCinemaById = async (cinemaId: string) => {
  // Check if cinema exists before archiving
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  if (!cinema) {
    logger.warn("Cinema not found for archiving", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  // Archive the cinema by setting isActive to false
  const archivedCinema = await prisma.cinema.update({
    where: { id: cinemaId },
    data: { isActive: false },
  });
  logger.info("Archived cinema", { archivedCinema });
  return { message: "Cinema archived successfully" };
};

export const restoreCinemaById = async (cinemaId: string) => {
  // Check if cinema exists before restoring
  const cinema = await prisma.cinema.findUnique({
    where: { id: cinemaId },
  });
  if (!cinema) {
    logger.warn("Cinema not found for restoration", { cinemaId });
    throw new CustomError("Cinema not found", 404);
  }
  // Restore the cinema by setting isActive to true
  const restoredCinema = await prisma.cinema.update({
    where: { id: cinemaId },
    data: { isActive: true },
  });
  logger.info("Restored cinema", { restoredCinema });
  return { message: "Cinema restored successfully" };
};
