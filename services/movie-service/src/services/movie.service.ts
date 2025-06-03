import logger from "../utils/logger.js";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
  uploadVideoToCloudinary,
  deleteVideoFromCloudinary,
} from "../utils/cloudinary.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";

export const getCategories = async ({
  page = 1,
  limit = 10,
  search = "",
}: {
  page?: number;
  limit?: number;
  search?: string;
}) => {
  const categories = await prisma.category.findMany({
    where: {
      name: { contains: search, mode: "insensitive" },
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  const totalItems = await prisma.category.count({
    where: {
      name: { contains: search, mode: "insensitive" },
    },
  });
  logger.info("Fetched categories", { categories, totalItems, page, limit });
  return {
    categories,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getCategoryById = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
  });
  if (!category) {
    logger.warn("Category not found", { categoryId });
    throw new CustomError("Category not found", 404);
  }
  logger.info("Fetched category", { category });
  return category;
};

export const createCategory = async (name: string, description: string) => {
  const existingCategory = await prisma.category.findUnique({
    where: { name },
  });
  if (existingCategory) {
    logger.warn("Category already exists", { name });
    throw new CustomError("Category already exists", 400);
  }
  const category = await prisma.category.create({
    data: { name, description },
  });
  logger.info("Created category", { category });
  return category;
};

export const updateCategoryById = async (
  categoryId: string,
  name: string,
  description: string
) => {
  const updateData: any = {
    name,
    description,
  };
  const updatedCategory = await prisma.category.update({
    where: { id: categoryId },
    data: updateData,
  });
  if (!updatedCategory) {
    logger.warn("Category not found for update", { categoryId });
    throw new CustomError("Category not found", 404);
  }
  logger.info("Updated category", { updatedCategory });
  return updatedCategory;
};

export const archiveCategoryById = async (categoryId: string) => {
  const archivedCategory = await prisma.category.update({
    where: { id: categoryId },
    data: { isActive: false },
  });
  if (!archivedCategory) {
    logger.warn("Category not found for archiving", { categoryId });
    throw new CustomError("Category not found", 404);
  }
  logger.info("Archived category", { archivedCategory });
  return { message: "Category archived successfully" };
};

export const restoreCategoryById = async (categoryId: string) => {
  const category = await prisma.category.update({
    where: { id: categoryId },
    data: { isActive: true },
  });
  if (!category) {
    logger.warn("Category not found for restoring", { categoryId });
    throw new CustomError("Category not found", 404);
  }
  logger.info("Restored category", { category });
  return { message: "Category restored successfully" };
};

export const getMovies = async ({
  page = 1,
  limit = 10,
  search = "",
  categoryId,
  rating,
}: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  rating?: number;
}) => {
  const where: any = {};
  if (categoryId) {
    where.categoryId = categoryId;
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
    include: { categories: true },
    skip: (page - 1) * limit,
    take: limit,
  });
  const totalItems = await prisma.movie.count({ where });

  logger.info("Fetched movies", { movies, totalItems, page, limit });
  return {
    movies,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getMovieById = async (movieId: string) => {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: { categories: true },
  });
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
  categories: string[],
  thumbnailUrl: string,
  trailerUrl: string
) => {
  const existingMovie = await prisma.movie.findUnique({
    where: { title },
  });
  if (existingMovie) {
    logger.warn("Movie already exists", { title });
    throw new CustomError("Movie already exists", 400);
  }

  const thumbnailUpload = await uploadImageToCloudinary(thumbnailUrl);
  const trailerUpload = await uploadVideoToCloudinary(trailerUrl);

  if (!thumbnailUpload || !trailerUpload) {
    logger.error("Failed to upload media to Cloudinary", {
      thumbnailUrl,
      trailerUrl,
    });
    throw new CustomError("Failed to upload media", 500);
  }

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
      categories: {
        connect: categories.map((id) => ({ id })),
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
    categories?: string[];
    thumbnail?: string;
    trailerUrl?: string;
  }
) => {
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
  // Update categories if provided
  if (data.categories) {
    updateData.categories = {
      set: data.categories.map((id) => ({ id })),
    };
  }
  // Handle categories update
  const updatedMovie = await prisma.movie.update({
    where: { id: movieId },
    data: updateData,
  });

  logger.info("Updated movie", { updatedMovie });
  return updatedMovie;
};

export const deleteMovieById = async (movieId: string) => {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
  });
  if (!movie) {
    logger.warn("Movie not found for deletion", { movieId });
    throw new CustomError("Movie not found", 404);
  }
  // Delete thumbnail and trailer from Cloudinary
  if (movie.thumbnailPublicId) {
    const deleteThumbnailResult = await deleteImageFromCloudinary(
      movie.thumbnailPublicId
    );
    if (!deleteThumbnailResult) {
      logger.error("Failed to delete thumbnail from Cloudinary", {
        thumbnail: movie.thumbnailPublicId,
      });
      throw new CustomError("Failed to delete thumbnail", 500);
    }
  }
  // Delete trailer from Cloudinary
  if (movie.trailerPublicId) {
    const deleteTrailerResult = await deleteVideoFromCloudinary(
      movie.trailerPublicId
    );
    if (!deleteTrailerResult) {
      logger.error("Failed to delete trailer from Cloudinary", {
        trailer: movie.trailerPublicId,
      });
      throw new CustomError("Failed to delete trailer", 500);
    }
  }
  // Delete movie from database
  await prisma.movie.delete({
    where: { id: movieId },
  });

  logger.info("Deleted movie", { movieId });
  return { message: "Movie deleted successfully" };
};
