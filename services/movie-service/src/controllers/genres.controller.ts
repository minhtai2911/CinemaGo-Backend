import { Request, Response } from "express";
import * as GenresService from "../services/genres.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getGenres = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, isActive } = req.query;
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const { genres, totalItems, totalPages } = await GenresService.getGenres({
    page: pageNumber,
    limit: limitNumber,
    search: search ? String(search) : "",
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
    data: genres,
  });
});

export const getGenreById = asyncHandler(
  async (req: Request, res: Response) => {
    const genreId = req.params.genreId;
    const genre = await GenresService.getGenreById(genreId);
    res.status(200).json({ data: genre });
  }
);

export const createGenre = asyncHandler(async (req: Request, res: Response) => {
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const genre = await GenresService.createGenre(name, description);
  res.status(201).json({ data: genre });
});

export const updateGenreById = asyncHandler(
  async (req: Request, res: Response) => {
    const genreId = req.params.genreId;
    const { name, description } = req.body;
    if (!name || !description) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const genre = await GenresService.updateGenreById(
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
    const message = await GenresService.archiveGenreById(genreId);
    res.status(200).json(message);
  }
);

export const restoreGenreById = asyncHandler(
  async (req: Request, res: Response) => {
    const genreId = req.params.genreId;
    const message = await GenresService.restoreGenreById(genreId);
    res.status(200).json(message);
  }
);
