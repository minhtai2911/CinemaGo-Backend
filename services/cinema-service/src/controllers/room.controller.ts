import { Request, Response } from "express";
import * as roomService from "../services/room.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";

export const getRooms = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search } = req.query;
  const pageNumber = Number(page) || 1;
  const limitNumber = Number(limit) || 10;
  const data = await roomService.getRooms({
    page: pageNumber,
    limit: limitNumber,
    search: String(search) || "",
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
    const { name, cinemaId, seatLayout, vipPrice, couplePrice } = req.body;
    if (!name || !cinemaId || !seatLayout || !vipPrice || !couplePrice) {
      return res.status(400).json({ message: "All fields are required" });
    }
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

export const deleteRoomById = asyncHandler(
  async (req: Request, res: Response) => {
    const roomId = req.params.id;
    await roomService.deleteRoomById(roomId);
    res.status(204).send();
  }
);
