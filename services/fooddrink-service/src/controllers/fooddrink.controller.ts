import { Request, Response } from "express";
import * as fooddrinkService from "../services/fooddrink.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const getFoodDrinks = asyncHandler(
  async (req: Request, res: Response) => {
    const { page, limit, search, isAvailable, cinemaId } = req.query;

    const data = await fooddrinkService.getFoodDrinks({
      page: Number(page) || undefined,
      limit: Number(limit) || undefined,
      search: search ? String(search) : "",
      isAvailable:
        isAvailable !== undefined ? isAvailable === "true" : undefined,
      cinemaId: cinemaId ? String(cinemaId) : "",
    });

    res.status(200).json({
      pagination: {
        totalItems: data.totalItems,
        totalPages: data.totalPages,
        currentPage: Number(page) || 1,
        pageSize: Number(limit) || data.totalItems,
        hasNextPage: Number(page) ? Number(page) < data.totalPages : false,
        hasPrevPage: Number(page) ? Number(page) > 1 : false,
      },
      data: data.foodDrinks,
    });
  }
);

export const getFoodDrinkById = asyncHandler(
  async (req: Request, res: Response) => {
    const foodDrinkId = req.params.id;

    const foodDrink = await fooddrinkService.getFoodDrinkById(foodDrinkId);

    res.status(200).json({ data: foodDrink });
  }
);

export const createFoodDrink = asyncHandler(
  async (req: Request, res: Response) => {
    const { name, description, price, type, cinemaId } = req.body;
    const image = req.file?.path;

    if (!name || !description || !price || !type || !image || !cinemaId) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const foodDrink = await fooddrinkService.createFoodDrink(
      name,
      description,
      Number(price),
      image,
      type,
      cinemaId
    );

    res.status(201).json({ data: foodDrink });
  }
);

export const updateFoodDrinkById = asyncHandler(
  async (req: Request, res: Response) => {
    const foodDrinkId = req.params.id;
    const { name, description, price, type, cinemaId } = req.body;
    const image = req.file?.path;

    const foodDrink = await fooddrinkService.updateFoodDrinkById(foodDrinkId, {
      name,
      description,
      price: price ? Number(price) : undefined,
      image,
      type,
      cinemaId,
    });

    res.status(200).json({ data: foodDrink });
  }
);

export const toggleFoodDrinkAvailability = asyncHandler(
  async (req: Request, res: Response) => {
    const foodDrinkId = req.params.id;

    const foodDrink = await fooddrinkService.toggleFoodDrinkAvailability(
      foodDrinkId
    );

    res.status(200).json({ data: foodDrink });
  }
);

export const getFoodDrinkByIds = asyncHandler(
  async (req: Request, res: Response) => {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "IDs array is required" });
    }

    const foodDrinks = await fooddrinkService.getFoodDrinkByIds(ids);
    res.status(200).json({ data: foodDrinks });
  }
);
