import { Request, Response } from "express";
import * as roomService from "../services/room.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const getRooms = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, isActive, startTime, endTime } = req.query;
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const data = await roomService.getRooms({
    page: pageNumber,
    limit: limitNumber,
    search: search ? String(search) : "",
    isActive: isActive !== undefined ? isActive === "true" : undefined,
    startTime: startTime ? new Date(startTime as string) : undefined,
    endTime: endTime ? new Date(endTime as string) : undefined,
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
    data: data.rooms,
  });
});

export const getRoomById = asyncHandler(async (req: Request, res: Response) => {
  const roomId = req.params.id;
  const room = await roomService.getRoomById(roomId);
  res.status(200).json({ data: room });
});

export const createRoom = asyncHandler(async (req: Request, res: Response) => {
  const { name, cinemaId, seatLayout, vipPrice, couplePrice } = req.body;
  if (!name || !cinemaId || !seatLayout || !vipPrice || !couplePrice) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const room = await roomService.createRoom(
    name,
    cinemaId,
    seatLayout,
    vipPrice,
    couplePrice
  );
  res.status(201).json({ data: room });
});

export const updateRoomById = asyncHandler(
  async (req: Request, res: Response) => {
    const roomId = req.params.id;
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }
    const { name, cinemaId, seatLayout, vipPrice, couplePrice } = req.body;
    const room = await roomService.updateRoomById(
      roomId,
      name,
      cinemaId,
      seatLayout,
      vipPrice,
      couplePrice
    );
    res.status(200).json({ data: room });
  }
);

export const archiveRoomById = asyncHandler(
  async (req: Request, res: Response) => {
    const roomId = req.params.id;
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }
    const message = await roomService.archiveRoomById(roomId);
    res.status(200).json(message);
  }
);

export const restoreRoomById = asyncHandler(
  async (req: Request, res: Response) => {
    const roomId = req.params.id;
    if (!roomId) {
      return res.status(400).json({ message: "Room ID is required" });
    }
    const message = await roomService.restoreRoomById(roomId);
    res.status(200).json(message);
  }
);

export const holdSeat = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const { showtimeId, seatId } = req.body;
    const userId = req.user?.userId;
    if (!showtimeId || !seatId || !userId) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const message = await roomService.holdSeat(
      req.redisClient,
      userId,
      showtimeId,
      seatId
    );
    res.status(200).json(message);
  }
);

export const getHeldSeats = asyncHandler(
  async (req: Request, res: Response) => {
    const { showtimeId } = req.params;
    if (!showtimeId) {
      return res.status(400).json({ message: "Showtime ID is required" });
    }
    const heldSeats = await roomService.getHeldSeats(
      req.redisClient,
      showtimeId
    );
    res.status(200).json({ data: heldSeats });
  }
);
