import logger from "../utils/logger.js";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  uploadVideoToCloudinary,
  deleteVideoFromCloudinary,
} from "../utils/cloudinary.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";

export const getMovies = async ({
  page = 1,
  limit = 10,
  search = "",
  genreIds,
  rating,
}: {
  page?: number;
  limit?: number;
  search?: string;
  genreIds?: string[];
  rating?: number;
}) => {
  // Fetch movies with pagination, search, genre filter, and rating filter
  const where: any = {};
  if (genreIds && genreIds.length > 0) {
    where.genres = {
      some: {
        id: { in: genreIds },
      },
    };
  }
  if (rating) {
    where.rating = {
      gte: rating,
    };
  }
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }
  const movies = await prisma.movie.findMany({
    where,
    include: { genres: true },
    skip: (page - 1) * limit,
    take: limit,
  });
  // Count total items for pagination
  const totalItems = await prisma.movie.count({ where });

  logger.info("Fetched movies", { movies, totalItems, page, limit });
  return {
    movies,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getMovieById = async (movieId: string) => {
  // Fetch movie by ID with genres
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: { genres: true },
  });
  // Check if movie exists
  if (!movie) {
    logger.warn("Movie not found", { movieId });
    throw new CustomError("Movie not found", 404);
  }
  logger.info("Fetched movie", { movie });
  return movie;
};

export const createMovie = async (
  title: string,
  description: string,
  duration: number,
  releaseDate: Date,
  genres: string[],
  thumbnailUrl: string,
  trailerUrl: string
) => {
  // Check if movie already exists
  const existingMovie = await prisma.movie.findUnique({
    where: { title },
  });
  // If movie exists, throw an error
  if (existingMovie) {
    logger.warn("Movie already exists", { title });
    throw new CustomError("Movie already exists", 409);
  }

  const thumbnailUpload = await uploadImageToCloudinary(thumbnailUrl);
  const trailerUpload = await uploadVideoToCloudinary(trailerUrl);

  // Check if uploads were successful
  if (!thumbnailUpload || !trailerUpload) {
    logger.error("Failed to upload media to Cloudinary", {
      thumbnailUrl,
      trailerUrl,
    });
    throw new CustomError("Failed to upload media", 500);
  }

  // Create movie with uploaded media and genres
  const movie = await prisma.movie.create({
    data: {
      title,
      description,
      duration,
      releaseDate,
      thumbnail: thumbnailUpload.secure_url,
      thumbnailPublicId: thumbnailUpload.public_id,
      trailerUrl: trailerUpload.secure_url,
      trailerPublicId: trailerUpload.public_id,
      genres: {
        connect: genres.map((id) => ({ id })),
      },
    },
  });

  logger.info("Created movie", { movie });
  return movie;
};

export const updateMovieById = async (
  movieId: string,
  data: {
    title: string;
    description: string;
    duration: number;
    releaseDate: Date;
    genres?: string[];
    thumbnail?: string;
    trailerUrl?: string;
  }
) => {
  // Check if movie exists
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });
  if (!movie) {
    logger.warn("Movie not found for update", { movieId });
    throw new CustomError("Movie not found", 404);
  }
  // Check if any fields are provided for update
  const updateData: any = {
    title: data.title,
    description: data.description,
    duration: data.duration,
    releaseDate: data.releaseDate,
  };
  if (data.thumbnail) {
    // Handle thumbnail upload and deletion
    const existingThumbnail = movie.thumbnail;
    if (existingThumbnail) {
      const deleteResult = await deleteImageFromCloudinary(existingThumbnail);
      if (!deleteResult) {
        logger.error("Failed to delete existing thumbnail from Cloudinary", {
          thumbnail: existingThumbnail,
        });
        throw new CustomError("Failed to delete existing thumbnail", 500);
      }
    }
    const thumbnailUpload = await uploadImageToCloudinary(data.thumbnail);
    if (!thumbnailUpload) {
      logger.error("Failed to upload thumbnail to Cloudinary", {
        thumbnail: data.thumbnail,
      });
      throw new CustomError("Failed to upload thumbnail", 500);
    }
    updateData.thumbnail = thumbnailUpload.secure_url;
    updateData.thumbnailPublicId = thumbnailUpload.public_id;
  }
  if (data.trailerUrl) {
    // Handle trailer upload and deletion
    const existingTrailer = movie.trailerUrl;
    if (existingTrailer) {
      const deleteResult = await deleteVideoFromCloudinary(existingTrailer);
      if (!deleteResult) {
        logger.error("Failed to delete existing trailer from Cloudinary", {
          trailer: existingTrailer,
        });
        throw new CustomError("Failed to delete existing trailer", 500);
      }
    }
    const trailerUpload = await uploadVideoToCloudinary(data.trailerUrl);
    if (!trailerUpload) {
      logger.error("Failed to upload trailer to Cloudinary", {
        trailer: data.trailerUrl,
      });
      throw new CustomError("Failed to upload trailer", 500);
    }
    updateData.trailerUrl = trailerUpload.secure_url;
    updateData.trailerPublicId = trailerUpload.public_id;
  }
  // Update genres if provided
  if (data.genres && data.genres.length > 0) {
    updateData.genres = {
      set: data.genres.map((id) => ({ id })),
    };
  }
  // Handle genres update
  const updatedMovie = await prisma.movie.update({
    where: { id: movieId },
    data: updateData,
  });

  logger.info("Updated movie", { updatedMovie });
  return updatedMovie;
};

export const archiveMovieById = async (movieId: string) => {
  // Check if movie exists
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });
  if (!movie) {
    logger.warn("Movie not found for archiving", { movieId });
    throw new CustomError("Movie not found", 404);
  }
  // Archive movie by setting a flag or removing it from active listings
  const archivedMovie = await prisma.movie.update({
    where: { id: movieId },
    data: { isActive: false }, // Assuming you have an isActive field
  });

  logger.info("Archived movie", { archivedMovie });
  return { message: "Movie archived successfully" };
};

export const restoreMovieById = async (movieId: string) => {
  // Check if movie exists
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });
  if (!movie) {
    logger.warn("Movie not found for restoration", { movieId });
    throw new CustomError("Movie not found", 404);
  }
  // Restore movie by removing the archived flag
  const restoredMovie = await prisma.movie.update({
    where: { id: movieId },
    data: { isActive: true }, // Assuming you have an isActive field
  });

  logger.info("Restored movie", { restoredMovie });
  return { message: "Movie restored successfully" };
};
