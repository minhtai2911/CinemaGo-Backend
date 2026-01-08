import { Request, Response } from "express";
import * as showtimeService from "../services/showtime.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getShowtimes = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, movieId, cinemaId, isActive, startTime, endTime } =
      req.query;

    const data = await showtimeService.getShowtimes({
      page: Number(page) || undefined,
      limit: Number(limit) || undefined,
      movieId: movieId ? String(movieId) : undefined,
      cinemaId: cinemaId ? String(cinemaId) : undefined,
      isActive: isActive !== undefined ? isActive === "true" : undefined,
      startTime: startTime ? new Date(startTime as string) : undefined,
      endTime: endTime ? new Date(endTime as string) : undefined,
    });

    res.status(200).json({
      pagination: {
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        currentPage: page ? Number(page) : 1,
        pageSize: limit ? Number(limit) : data.totalItems,
        hasNextPage: page ? Number(page) < data.totalPages : false,
        hasPrevPage: page ? Number(page) > 1 : false,
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
      Number(price),
      language,
      Boolean(subtitle),
      format
    );

    res.status(201).json({ data: showtime });
  }
);

export const updateShowtimeById = asyncHandler(
  async (req: Request, res: Response) => {
    const showtimeId = req.params.id;

    if (!showtimeId) {
      return res.status(400).json({ message: "Showtime ID is required" });
    }

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
        price: Number(price),
        language,
        subtitle: Boolean(subtitle),
        format,
      }
    );

    res.status(200).json({ data: updatedShowtime });
  }
);

export const archiveShowtimeById = asyncHandler(
  async (req: Request, res: Response) => {
    const showtimeId = req.params.id;

    if (!showtimeId) {
      return res.status(400).json({ message: "Showtime ID is required" });
    }

    const message = await showtimeService.archiveShowtimeById(showtimeId);

    res.status(200).json(message);
  }
);

export const restoreShowtimeById = asyncHandler(
  async (req: Request, res: Response) => {
    const showtimeId = req.params.id;

    if (!showtimeId) {
      return res.status(400).json({ message: "Showtime ID is required" });
    }

    const message = await showtimeService.restoreShowtimeById(showtimeId);

    res.status(200).json(message);
  }
);

export const getBusyRoomIds = asyncHandler(
  async (req: Request, res: Response) => {
    const { startTime, endTime, cinemaId } = req.query;

    if (!startTime || !endTime) {
      return res
        .status(400)
        .json({ message: "Start time and end time are required" });
    }

    const busyRoomIds = await showtimeService.getBusyRoomIds(
      new Date(startTime as string),
      new Date(endTime as string),
      cinemaId ? String(cinemaId) : undefined
    );

    res.status(200).json({ data: busyRoomIds });
  }
);

export const getShowtimesByIds = asyncHandler(
  async (req: Request, res: Response) => {
    const { showtimeIds } = req.body;

    if (
      !showtimeIds ||
      !Array.isArray(showtimeIds) ||
      showtimeIds.length === 0
    ) {
      return res
        .status(400)
        .json({ message: "showtimeIds must be a non-empty array" });
    }

    const showtimes = await showtimeService.getShowtimesByIds(showtimeIds);

    res.status(200).json({ data: showtimes });
  }
);

export const healthCheck = asyncHandler(async (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});
