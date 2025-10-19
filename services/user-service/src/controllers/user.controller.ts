import { Request, Response } from "express";
import * as UserService from "../services/user.service.js";
import { asyncHandler } from "../middlewares/asyncHandler.js";
import { AuthenticatedRequest } from "../middlewares/authMiddleware.js";

export const getUsers = asyncHandler(async (req: Request, res: Response) => {
  const { page, limit, search, role, isActive } = req.query;

  const { users, totalItems, totalPages } = await UserService.getUsers({
    page: Number(page) || undefined,
    limit: Number(limit) || undefined,
    search: search ? String(search) : "",
    role: role ? String(role) : undefined,
    isActive: isActive !== undefined ? isActive === "true" : undefined,
  });

  res.status(200).json({
    pagination: {
      totalItems,
      totalPages,
      currentPage: page ? Number(page) : 1,
      pageSize: limit ? Number(limit) : totalItems,
      hasNextPage: page ? Number(page) < totalPages : false,
      hasPrevPage: page ? Number(page) > 1 : false,
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
  const { email, fullname, password, role, gender } = req.body;
  if (!email || !fullname || !password || !role || !gender) {
    return res.status(400).json({ message: "All fields are required" });
  }
  const user = await UserService.createUser({
    email,
    fullname,
    password,
    gender,
    role,
  });
  res.status(201).json({ data: user, message: "User created successfully" });
});

export const updateUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const { fullname, role, password, gender } = req.body;
    if (!fullname || !role || !gender) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const user = await UserService.updateUserById(userId, {
      fullname,
      password,
      role,
      gender,
    });
    res.status(200).json({ data: user, message: "User updated successfully" });
  }
);

export const archiveUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const message = await UserService.archiveUserById(userId);
    res.status(200).json(message);
  }
);

export const restoreUserById = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.params.id;
    const message = await UserService.restoreUserById(userId);
    res.status(200).json(message);
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
    const { fullname, gender } = req.body;
    const avatarUrl = req.file?.path;
    if (!fullname || !gender) {
      return res
        .status(400)
        .json({ message: "Fullname and gender are required" });
    }
    const user = await UserService.updateProfile(
      userId,
      fullname,
      gender,
      avatarUrl
    );
    res
      .status(200)
      .json({ data: user, message: "Profile updated successfully" });
  }
);
