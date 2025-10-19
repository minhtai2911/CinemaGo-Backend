import { Request, Response } from "express";
import * as MovieService from "../services/movie.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getMovies = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, rating, genreQuery, isActive, status } =
    req.query;
  let genreIds: string[] = [];
  if (genreQuery) {
    genreIds = (genreQuery as string).split(",").map((id: string) => id.trim());
  }

  const { movies, totalItems, totalPages } = await MovieService.getMovies({
    page: Number(page) || undefined,
    limit: Number(limit) || undefined,
    search: search ? String(search) : "",
    genreIds: genreIds.length > 0 ? genreIds : undefined,
    rating: rating ? Number(rating) : undefined,
    isActive: isActive ? isActive === "true" : undefined,
    status: status ? String(status) : undefined,
  });

  res.status(200).json({
    pagination: {
      totalItems,
      totalPages,
      currentPage: Number(page) || 1,
      pageSize: Number(limit) || totalItems,
      hasNextPage: Number(page) ? Number(page) < totalPages : false,
      hasPrevPage: Number(page) ? Number(page) > 1 : false,
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
  const { title, description, duration, releaseDate, genresIds, trailerPath } =
    req.body;
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
    (!trailerUrl && !trailerPath)
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
    trailerUrl,
    trailerPath
  );
  res.status(201).json({ data: movie });
});

export const updateMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const {
      title,
      description,
      duration,
      releaseDate,
      genresIds,
      trailerPath,
    } = req.body;

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

    if (trailerPath) {
      data.trailerPath = trailerPath;
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

export const updateMovieStatusByIds = asyncHandler(
  async (req: Request, res: Response) => {
    const { movieIds, status } = req.body;

    if (!movieIds || !Array.isArray(movieIds) || movieIds.length === 0) {
      return res
        .status(400)
        .json({ message: "movieIds must be a non-empty array" });
    }

    if (!status) {
      return res.status(400).json({ message: "status is required" });
    }

    const message = await MovieService.updateMovieStatusByIds(movieIds, status);
    res.status(200).json(message);
  }
);
