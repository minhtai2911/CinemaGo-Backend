import { Request, Response } from "express";
import * as cinemaService from "../services/cinema.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getCinemas = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, isActive } = req.query;
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const data = await cinemaService.getCinemas({
    page: pageNumber,
    limit: limitNumber,
    search: search ? String(search) : "",
    isActive: isActive ? Boolean(isActive) : undefined,
  });
  res.status(200).json({
    pagination: {
      totalItems: data.totalItems,
      totalPages: data.totalPages,
      currentPage: pageNumber,
      pageSize: limitNumber > data.totalItems ? data.totalItems : limitNumber,
      hasNextPage: pageNumber < data.totalPages,
      hasPrevPage: pageNumber > 1,
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
    const { name, address, city, longitude, latitude } = req.body;
    if (!name || !address || !city) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const cinema = await cinemaService.createCinema(
      name,
      address,
      city,
      longitude,
      latitude
    );
    res.status(201).json({ data: cinema });
  }
);

export const updateCinemaById = asyncHandler(
  async (req: Request, res: Response) => {
    const cinemaId = req.params.id;
    const { name, address, city, longitude, latitude } = req.body;
    const cinema = await cinemaService.updateCinemaById(cinemaId, {
      name,
      address,
      city,
      longitude,
      latitude,
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
