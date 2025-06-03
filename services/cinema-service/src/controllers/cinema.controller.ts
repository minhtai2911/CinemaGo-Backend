import { Request, Response } from "express";
import * as cinemaService from "../services/cinema.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getCinemas = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search } = req.query;
  const data = await cinemaService.getCinemas({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search: String(search) || "",
  });
  res.status(200).json({
    pagination: {
      totalItems: data.totalItems,
      totalPages: data.totalPages,
      currentPage: Number(page),
      pageSize: Number(limit),
      hasNextPage: Number(page) < data.totalPages,
      hasPrevPage: Number(page) > 1,
    },
    data: data.cinemas,
  });
});

export const getCinemaById = asyncHandler(
  async (req: Request, res: Response) => {
    const cinemaId = req.params.id;
    const cinema = await cinemaService.getCinemaById(cinemaId);
    res.status(200).json({ data: cinema });
  }
);

export const createCinema = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, address } = req.body;
    if (!name || !address) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const cinema = await cinemaService.createCinema(name, address);
    res.status(201).json({ data: cinema });
  }
);

export const updateCinemaById = asyncHandler(
  async (req: Request, res: Response) => {
    const cinemaId = req.params.id;
    const { name, address } = req.body;
    if (!name || !address) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const cinema = await cinemaService.updateCinemaById(cinemaId, {
      name,
      address,
    });
    res.status(200).json({ data: cinema });
  }
);

export const archiveCinemaById = asyncHandler(
  async (req: Request, res: Response) => {
    const cinemaId = req.params.id;
    const message = await cinemaService.archiveCinemaById(cinemaId);
    res.status(200).json(message);
  }
);

export const restoreCinemaById = asyncHandler(
  async (req: Request, res: Response) => {
    const cinemaId = req.params.id;
    const message = await cinemaService.restoreCinemaById(cinemaId);
    res.status(200).json(message);
  }
);
