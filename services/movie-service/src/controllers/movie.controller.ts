import { Request, Response } from "express";
import * as MovieService from "../services/movie.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getMovies = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, rating, genreQuery, isActive } = req.query;
  let genreIds: string[] = [];
  if (genreQuery) {
    genreIds = (genreQuery as string).split(",").map((id: string) => id.trim());
  }
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const { movies, totalItems, totalPages } = await MovieService.getMovies({
    page: pageNumber,
    limit: limitNumber,
    search: search ? String(search) : "",
    genreIds: genreIds.length > 0 ? genreIds : undefined,
    rating: rating ? Number(rating) : undefined,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
  });
  res.status(200).json({
    pagination: {
      totalItems,
      totalPages,
      currentPage: pageNumber,
      pageSize: limitNumber < totalItems ? limitNumber : totalItems,
      hasNextPage: pageNumber < totalPages,
      hasPrevPage: pageNumber > 1,
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
  const { title, description, duration, releaseDate, genresIds } = req.body;
  const genresArray = genresIds
    ? genresIds.split(",").map((g: string) => g.trim())
    : [];
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const thumbnail = files?.["thumbnail"]?.[0]?.path || "";
  const trailerUrl = files?.["trailer"]?.[0]?.path || "";

  if (
    !title ||
    !description ||
    !duration ||
    !releaseDate ||
    !genresArray ||
    !thumbnail ||
    !trailerUrl
  ) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const movie = await MovieService.createMovie(
    title,
    description,
    Number(duration),
    new Date(releaseDate),
    genresArray,
    thumbnail,
    trailerUrl
  );
  res.status(201).json({ data: movie });
});

export const updateMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const { title, description, duration, releaseDate, genresIds } = req.body;

    const genresArray = genresIds
      ? genresIds.split(",").map((g: string) => g.trim())
      : [];
    const files = req.files as {
      [fieldname: string]: Express.Multer.File[];
    };

    const thumbnail = files?.["thumbnail"]?.[0]?.path || "";
    const trailerUrl = files?.["trailer"]?.[0]?.path || "";

    if (!title || !description || !duration || !releaseDate) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const data: any = {
      title,
      description,
      duration: Number(duration),
      releaseDate: new Date(releaseDate),
    };

    if (genresArray.length > 0) {
      data.genres = genresArray;
    }

    if (thumbnail) {
      data.thumbnail = thumbnail;
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
