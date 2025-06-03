import { Request, Response } from "express";
import * as showtimeService from "../services/showtime.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getShowtimes = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, movieId, cinemaId } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    const data = await showtimeService.getShowtimes({
      page: pageNumber,
      limit: limitNumber,
      movieId: String(movieId) || undefined,
      cinemaId: String(cinemaId) || undefined,
    });
    res.status(200).json({
      pagination: {
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        currentPage: pageNumber,
        pageSize: limitNumber,
        hasNextPage: pageNumber < data.totalPages,
        hasPrevPage: pageNumber > 1,
      },
      data: data.showtimes,
    });
  }
);

export const getShowtimeById = asyncHandler(
  async (req: Request, res: Response) => {
    const showtimeId = req.params.id;
    const showtime = await showtimeService.getShowtimeById(showtimeId);
    res.status(200).json({ data: showtime });
  }
);

export const createShowtime = asyncHandler(
  async (req: Request, res: Response) => {
    const {
      movieId,
      roomId,
      startTime,
      endTime,
      price,
      language,
      subtitle,
      format,
    } = req.body;
    if (
      !movieId ||
      !roomId ||
      !startTime ||
      !endTime ||
      !price ||
      !language ||
      subtitle === undefined ||
      !format
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const showtime = await showtimeService.createShowtime(
      movieId,
      roomId,
      new Date(startTime),
      new Date(endTime),
      price,
      language,
      subtitle,
      format
    );
    res.status(201).json({ data: showtime });
  }
);

export const updateShowtimeById = asyncHandler(
  async (req: Request, res: Response) => {
    const showtimeId = req.params.id;
    const {
      movieId,
      roomId,
      startTime,
      endTime,
      price,
      language,
      subtitle,
      format,
    } = req.body;
    const updatedShowtime = await showtimeService.updateShowtimeById(
      showtimeId,
      {
        movieId,
        roomId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
        price,
        language,
        subtitle,
        format,
      }
    );
    res.status(200).json({ data: updatedShowtime });
  }
);

export const deleteShowtimeById = asyncHandler(
  async (req: Request, res: Response) => {
    const showtimeId = req.params.id;
    const message = await showtimeService.deleteShowtimeById(showtimeId);
    res.status(200).json(message);
  }
);
