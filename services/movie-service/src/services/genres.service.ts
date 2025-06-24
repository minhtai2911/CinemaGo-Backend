import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";

export const getGenres = async ({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  // Fetch genres with pagination and search
  const genres = await prisma.genres.findMany({
    where: {
      name: { contains: search, mode: "insensitive" },
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  // Count total items for pagination
  const totalItems = await prisma.genres.count({
    where: {
      name: { contains: search, mode: "insensitive" },
    },
  });
  logger.info("Fetched genres", { genres, totalItems, page, limit });
  return {
    genres,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getGenreById = async (genreId: string) => {
  // Fetch genre by ID
  const genre = await prisma.genres.findUnique({
    where: { id: genreId },
  });
  // Check if genre exists
  if (!genre) {
    logger.warn("Genre not found", { genreId });
    throw new CustomError("Genre not found", 404);
  }
  logger.info("Fetched genre", { genre });
  return genre;
};

export const createGenre = async (name: string, description: string) => {
  // Check if genre already exists
  const existingGenre = await prisma.genres.findUnique({
    where: { name },
  });
  if (existingGenre) {
    logger.warn("Genre already exists", { name });
    throw new CustomError("Genre already exists", 409);
  }
  // Create new genre
  const genre = await prisma.genres.create({
    data: { name, description },
  });
  logger.info("Created genre", { genre });
  return genre;
};

export const updateGenreById = async (
  genreId: string,
  name: string,
  description: string
) => {
  const updateData: any = {
    name,
    description,
  };
  // Check if name is already taken
  const nameExists = await prisma.genres.findUnique({
    where: { name },
  });
  if (nameExists && nameExists.id !== genreId) {
    logger.warn("Genre name already exists", { name });
    throw new CustomError("Genre name already exists", 409);
  }
  // Update genre
  const updatedGenre = await prisma.genres.update({
    where: { id: genreId },
    data: updateData,
  });
  if (!updatedGenre) {
    logger.warn("Genre not found for update", { genreId });
    throw new CustomError("Genre not found", 404);
  }
  logger.info("Updated genre", { updatedGenre });
  return updatedGenre;
};

export const archiveGenreById = async (genreId: string) => {
  // Archive genre by setting isActive to false
  const archivedGenre = await prisma.genres.update({
    where: { id: genreId },
    data: { isActive: false },
  });
  // Check if genre exists
  if (!archivedGenre) {
    logger.warn("Genre not found for archiving", { genreId });
    throw new CustomError("Genre not found", 404);
  }
  logger.info("Archived genre", { archivedGenre });
  return { message: "Genre archived successfully" };
};

export const restoreGenreById = async (genreId: string) => {
  // Restore genre by setting isActive to true
  const genre = await prisma.genres.update({
    where: { id: genreId },
    data: { isActive: true },
  });
  // Check if genre exists
  if (!genre) {
    logger.warn("Genre not found for restoring", { genreId });
    throw new CustomError("Genre not found", 404);
  }
  logger.info("Restored genre", { genre });
  return { message: "Genre restored successfully" };
};