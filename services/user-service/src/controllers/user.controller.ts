import { Request, Response } from "express";
import * as UserService from "../services/user.service";
import { asyncHandler } from "../middlewares/asyncHandler";
import { AuthenticatedRequest } from "../middlewares/authMiddleware";

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, role } = req.query;
  const { users, totalItems, totalPages } = await UserService.getUsers({
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    search: String(search) || "",
    role: String(role) || undefined,
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
    data: users,
  });
});

export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.params.id;
  const user = await UserService.getUserById(userId);
  res.status(200).json({ data: user });
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { email, fullname, password, role } = req.body;
  const message = await UserService.createUser({
    email,
    fullname,
    password,
    role,
  });
  res.status(201).json({ message });
});

export const updateUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const { fullname, role, password } = req.body;
    const message = await UserService.updateUserById(userId, {
      fullname,
      password,
      role,
    });
    res.status(200).json({ message });
  }
);

export const archiveUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const message = await UserService.archiveUserById(userId);
    res.status(200).json({ message });
  }
);

export const unarchiveUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const message = await UserService.unarchiveUserById(userId);
    res.status(200).json({ message });
  }
);

export const getProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const user = await UserService.getProfile(userId);
    res.status(200).json({ data: user });
  }
);

export const updateProfile = asyncHandler(
  async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const { fullname, avatarUrl, publicId } = req.body;
    const message = await UserService.updateProfile(userId, {
      fullname,
      avatarUrl,
      publicId,
    });
    res.status(200).json({ message });
  }
);
