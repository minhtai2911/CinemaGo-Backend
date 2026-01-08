import logger from "../utils/logger.js";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  uploadVideoToCloudinary,
  deleteVideoFromCloudinary,
} from "../utils/cloudinary.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import { MovieStatus } from "../../generated/prisma/index.js";

export const getMovies = async ({
  page,
  limit,
  search = "",
  isActive,
  genreIds,
  rating,
  status,
  sortBy,
  sortOrder,
}: {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
  genreIds?: string[];
  rating?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: string;
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
  if (isActive !== undefined) {
    where.isActive = isActive;
  }
  if (status) {
    where.status = status;
  }

  const movies = await prisma.movie.findMany({
    where,
    include: {
      genres: {
        where: { isActive: true },
      },
    },
    orderBy: sortBy ? { [sortBy]: sortOrder || "asc" } : { createdAt: "desc" },
    ...(page && limit
      ? {
          skip: (page - 1) * limit,
          take: limit,
        }
      : {}),
  });
  // Count total items for pagination
  const totalItems = await prisma.movie.count({ where });

  logger.info("Fetched movies", { movies, totalItems, page, limit });
  return {
    movies,
    totalItems,
    totalPages: limit ? Math.ceil(totalItems / limit) : 1,
  };
};

export const getMovieById = async (movieId: string) => {
  // Fetch movie by ID with genres
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: {
      genres: {
        where: { isActive: true },
      },
    },
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
  thumbnail: string,
  trailerUrl: string,
  trailerPath: string,
  status: MovieStatus
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

  const [thumbnailUpload, trailerUpload] = await Promise.all([
    uploadImageToCloudinary(thumbnail),
    trailerUrl ? uploadVideoToCloudinary(trailerUrl) : Promise.resolve(null),
  ]);

  // Check if uploads were successful
  if (!thumbnailUpload || (trailerUrl && !trailerUpload)) {
    logger.error("Failed to upload media to Cloudinary", {
      thumbnail,
      trailerUrl,
    });
    throw new CustomError("Failed to upload media", 500);
  }

  // Create movie with uploaded media and genres
  try {
    const movie = await prisma.movie.create({
      data: {
        title,
        description,
        duration,
        releaseDate,
        status,
        thumbnail: thumbnailUpload.secure_url,
        thumbnailPublicId: thumbnailUpload.public_id,
        trailerUrl: trailerUpload ? trailerUpload.secure_url : trailerPath,
        trailerPublicId: trailerUpload ? trailerUpload.public_id : undefined,
        genres: {
          connect: genres.map((id) => ({ id })),
        },
      },
      include: {
        genres: {
          where: { isActive: true },
        },
      },
    });
    logger.info("Created movie", { movie });
    return movie;
  } catch (error) {
    logger.error("Failed to create movie", { error, title });
    await Promise.all([
      deleteImageFromCloudinary(thumbnailUpload.public_id).catch((err) => {
        logger.error("Failed to delete thumbnail", { err });
      }),
      trailerUpload
        ? deleteVideoFromCloudinary(trailerUpload.public_id).catch((err) => {
            logger.error("Failed to delete trailer", { err });
          })
        : Promise.resolve(),
    ]);
    throw new CustomError("Failed to create movie", 500);
  }
};

export const updateMovieById = async (
  movieId: string,
  data: {
    title: string;
    description: string;
    duration: number;
    status: string;
    releaseDate: Date;
    genres: string[];
    thumbnail?: string;
    trailerUrl?: string;
    trailerPath?: string;
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
  // Prepare data for update
  const updateData: any = {
    title: data.title,
    description: data.description,
    duration: data.duration,
    status: data.status,
    releaseDate: data.releaseDate,
  };
  // If thumbnail is provided, upload it
  let thumbnailUpload;
  if (data.thumbnail) {
    await deleteImageFromCloudinary(movie.thumbnailPublicId).catch((err) => {
      logger.error("Failed to delete old thumbnail", { err });
    });
    thumbnailUpload = await uploadImageToCloudinary(data.thumbnail);
    if (thumbnailUpload) {
      updateData.thumbnail = thumbnailUpload.secure_url;
      updateData.thumbnailPublicId = thumbnailUpload.public_id;
    } else {
      logger.error("Failed to upload thumbnail", { data });
      throw new CustomError("Failed to upload thumbnail", 500);
    }
  }
  // If trailer URL is provided, upload it
  let trailerUpload;
  if (data.trailerUrl && movie.trailerPublicId) {
    await deleteVideoFromCloudinary(movie.trailerPublicId).catch((err) => {
      logger.error("Failed to delete old trailer", { err });
    });
    trailerUpload = await uploadVideoToCloudinary(data.trailerUrl);
    if (trailerUpload) {
      updateData.trailerUrl = trailerUpload.secure_url;
      updateData.trailerPublicId = trailerUpload.public_id;
    } else {
      logger.error("Failed to upload trailer", { data });
      throw new CustomError("Failed to upload trailer", 500);
    }
  }
  // If genres are provided, update them
  if (data.genres && data.genres.length > 0) {
    updateData.genres = {
      set: data.genres.map((id) => ({ id })),
    };
  }
  // If trailerPath is provided, update it
  if (data.trailerPath) {
    updateData.trailerUrl = data.trailerPath;
  }
  // Handle genres update
  try {
    const updatedMovie = await prisma.movie.update({
      where: { id: movieId },
      data: updateData,
      include: {
        genres: {
          where: { isActive: true },
        },
      },
    });

    logger.info("Updated movie", { updatedMovie });
    return updatedMovie;
  } catch (error) {
    logger.error("Error updating movie", { error });
    // If update fails, clean up any uploaded media
    if (data.thumbnail) {
      await deleteImageFromCloudinary(updateData.thumbnailPublicId).catch(
        (err) => {
          logger.error("Failed to delete thumbnail", { err });
        }
      );
    }
    if (data.trailerUrl) {
      await deleteVideoFromCloudinary(updateData.trailerPublicId).catch(
        (err) => {
          logger.error("Failed to delete trailer", { err });
        }
      );
    }
    throw new CustomError("Failed to update movie", 500);
  }
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

export const updateMovieStatusByIds = async (
  movieIds: string[],
  status: MovieStatus
) => {
  // Validate input
  if (!Array.isArray(movieIds) || movieIds.length === 0) {
    throw new CustomError("Movie IDs are required", 400);
  }
  // Validate status
  if (!Object.values(MovieStatus).includes(status)) {
    throw new CustomError("Invalid movie status", 400);
  }
  // Update status for multiple movies
  const result = await prisma.movie.updateMany({
    where: { id: { in: movieIds } },
    data: { status },
  });

  logger.info("Movie statuses updated", {
    updatedCount: result.count,
    newStatus: status,
  });

  return {
    message: `Updated ${result.count} movie(s) to status "${status}" successfully`,
  };
};

export const getTotalMoviesCount = async () => {
  // Get total count of movies
  const count = await prisma.movie.count();

  logger.info("Total movies count fetched", { count });

  return count;
};

export const getMoviesByIds = async (movieIds: string[]) => {
  // Fetch movies by a list of IDs
  const movies = await prisma.movie.findMany({
    where: {
      id: { in: movieIds },
    },
  });

  logger.info("Fetched movies by IDs", { movieIds, count: movies.length });
  return movies;
};

export const calculateMovieRating = async (
  movieId: string,
  rating: number,
  totalReviews: number
) => {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });

  if (!movie) {
    logger.warn("Movie not found for rating calculation", { movieId });
    throw new CustomError("Movie not found", 404);
  }

  const newRating =
    totalReviews === 0
      ? rating
      : (movie.rating * totalReviews + rating) / (totalReviews + 1);

  await prisma.movie.update({
    where: { id: movieId },
    data: { rating: newRating },
  });

  logger.info("Updated movie rating", { movieId, rating: newRating });
  return { message: "Movie rating updated successfully" };
};

export const getTopRatedMovies = async (limit: number) => {
  // Fetch top-rated movies
  const movies = await prisma.movie.findMany({
    where: {
      rating: {
        gt: 0,
      },
      isActive: true,
      status: MovieStatus.NOW_SHOWING,
    },
    orderBy: { rating: "desc" },
    take: limit,
    include: {
      genres: {
        where: { isActive: true },
      },
    },
  });

  logger.info("Fetched top-rated movies", { limit, count: movies.length });
  return movies;
};
