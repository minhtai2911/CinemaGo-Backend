import { Request, Response } from "express";
import * as MovieService from "../services/movie.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const getCategories = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, search } = req.query;
    const { categories, totalItems, totalPages } =
      await MovieService.getCategories({
        page: Number(page) || 1,
        limit: Number(limit) || 10,
        search: String(search) || "",
      });
    res.status(200).json({
      pagination: {
        totalItems,
        totalPages,
        currentPage: Number(page),
        pageSize: Number(limit),
        hasNextPage: Number(page) < totalPages,
        hasPrevPage: Number(page) > 1,
      },
      data: categories,
    });
  }
);

export const getCategoryById = asyncHandler(
  async (req: Request, res: Response) => {
    const categoryId = req.params.categoryId;
    const category = await MovieService.getCategoryById(categoryId);
    res.status(200).json({ data: category });
  }
);

export const createCategory = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const category = await MovieService.createCategory(name, description);
    res.status(201).json({ data: category });
  }
);

export const updateCategoryById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const categoryId = req.params.categoryId;
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const category = await MovieService.updateCategoryById(
      categoryId,
      name,
      description
    );
    res.status(200).json({ data: category });
  }
);

export const archiveCategoryById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const categoryId = req.params.categoryId;
    const message = await MovieService.archiveCategoryById(categoryId);
    res.status(200).json(message);
  }
);

export const restoreCategoryById = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const categoryId = req.params.categoryId;
    const message = await MovieService.restoreCategoryById(categoryId);
    res.status(200).json(message);
  }
);

export const getMovies = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, categoryId, rating } = req.query;
  const { movies, totalItems, totalPages } = await MovieService.getMovies({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search: String(search) || "",
    categoryId: String(categoryId) || undefined,
    rating: Number(rating) || undefined,
  });
  res.status(200).json({
    pagination: {
      totalItems,
      totalPages,
      currentPage: Number(page),
      pageSize: Number(limit),
      hasNextPage: Number(page) < totalPages,
      hasPrevPage: Number(page) > 1,
    },
    data: movies,
  });
});

export const getMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const movie = await MovieService.getMovieById(movieId);
    res.status(200).json({ data: movie });
  }
);

export const createMovie = asyncHandler(async (req: Request, res: Response) => {
  const { title, description, duration, releaseDate, categories } = req.body;
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const thumbnailUrl = files?.["thumbnail"]?.[0]?.path || "";
  const trailerUrl = files?.["trailer"]?.[0]?.path || "";

  if (
    !title ||
    !description ||
    !duration ||
    !releaseDate ||
    !categories ||
    !thumbnailUrl ||
    !trailerUrl
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const movie = await MovieService.createMovie(
    title,
    description,
    duration,
    new Date(releaseDate),
    categories,
    thumbnailUrl,
    trailerUrl
  );
  res.status(201).json({ data: movie });
});

export const updateMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const { title, description, duration, releaseDate, categories } = req.body;
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const thumbnailUrl = files?.["thumbnail"]?.[0]?.path || "";
    const trailerUrl = files?.["trailer"]?.[0]?.path || "";

    if (!title || !description || !duration || !releaseDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const data: any = {
      title,
      description,
      duration,
      releaseDate: new Date(releaseDate),
    };

    if (categories) {
      data.categories = categories;
    }
    if (thumbnailUrl) {
      data.thumbnailUrl = thumbnailUrl;
    }
    if (trailerUrl) {
      data.trailerUrl = trailerUrl;
    }

    const movie = await MovieService.updateMovieById(movieId, data);
    res.status(200).json({ data: movie });
  }
);

export const deleteMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const message = await MovieService.deleteMovieById(movieId);
    res.status(200).json(message);
  }
);
