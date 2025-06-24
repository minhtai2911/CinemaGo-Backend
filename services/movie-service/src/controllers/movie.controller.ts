import { Request, Response } from "express";
import * as MovieService from "../services/movie.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getMovies = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, rating, genreQuery } = req.query;
  let genreIds: string[] = [];
  if (genreQuery) {
    genreIds = (genreQuery as string).split(",").map((id: string) => id.trim());
  }

  const { movies, totalItems, totalPages } = await MovieService.getMovies({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search: String(search) || "",
    genreIds: genreIds.length > 0 ? genreIds : undefined,
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
  const { title, description, duration, releaseDate, genres } = req.body;
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
    !genres ||
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
    genres,
    thumbnailUrl,
    trailerUrl
  );
  res.status(201).json({ data: movie });
});

export const updateMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const { title, description, duration, releaseDate, genres } = req.body;
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

    if (genres) {
      data.genres = genres;
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

export const archiveMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const message = await MovieService.archiveMovieById(movieId);
    res.status(200).json(message);
  }
);

export const restoreMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const message = await MovieService.restoreMovieById(movieId);
    res.status(200).json(message);
  }
);
