import { Request, Response } from "express";
import * as MovieService from "../services/movie.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getGenres = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, search } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const { genres, totalItems, totalPages } =
      await MovieService.getGenres({
        page: pageNumber,
        limit: limitNumber,
        search: String(search) || "",
      });
    res.status(200).json({
      pagination: {
        totalItems,
        totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
        hasNextPage: pageNumber < totalPages,
        hasPrevPage: pageNumber > 1,
      },
      data: genres,
    });
  }
);

export const getGenreById = asyncHandler(
  async (req: Request, res: Response) => {
    const genreId = req.params.genreId;
    const genre = await MovieService.getGenreById(genreId);
    res.status(200).json({ data: genre });
  }
);

export const createGenre = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const genre = await MovieService.createGenre(name, description);
    res.status(201).json({ data: genre });
  }
);

export const updateGenreById = asyncHandler(
  async (req: Request, res: Response) => {
    const genreId = req.params.genreId;
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const genre = await MovieService.updateGenreById(
      genreId,
      name,
      description
    );
    res.status(200).json({ data: genre });
  }
);

export const archiveGenreById = asyncHandler(
  async (req: Request, res: Response) => {
    const genreId = req.params.genreId;
    const message = await MovieService.archiveGenreById(genreId);
    res.status(200).json(message);
  }
);

export const restoreGenreById = asyncHandler(
  async (req: Request, res: Response) => {
    const genreId = req.params.genreId;
    const message = await MovieService.restoreGenreById(genreId);
    res.status(200).json(message);
  }
);

export const getMovies = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, genreId, rating } = req.query;
  const { movies, totalItems, totalPages } = await MovieService.getMovies({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search: String(search) || "",
    genreId: String(genreId) || undefined,
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

export const deleteMovieById = asyncHandler(
  async (req: Request, res: Response) => {
    const movieId = req.params.movieId;
    const message = await MovieService.deleteMovieById(movieId);
    res.status(200).json(message);
  }
);
