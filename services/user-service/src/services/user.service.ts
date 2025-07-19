import prisma from "../config/db.js";
import logger from "../utils/logger.js";
import bcrypt from "bcrypt";
import { CustomError } from "../utils/customError.js";
import { Role } from "generated/prisma/index.js";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from "../utils/cloudinary.js";

export const getUsers = async ({
  page = 1,
  limit = 10,
  search = "",
  role,
}: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}) => {
  const users = await prisma.user.findMany({
    where: {
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { fullname: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(role && { role: role as Role }),
    },
    skip: (page - 1) * limit,
    take: limit,
  });
  const totalItems = await prisma.user.count({
    where: {
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" } },
          { fullname: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(role && { role: role as Role }),
    },
  });
  logger.info("Fetched users", { users, totalItems, page, limit });
  return {
    users,
    totalItems,
    totalPages: Math.ceil(totalItems / limit),
  };
};

export const getUserById = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    logger.warn("User not found", { userId });
    throw new CustomError("User not found", 404);
  }
  logger.info("Fetched user by ID", { userId, user });
  return user;
};

export const createUser = async (userData: {
  email: string;
  fullname: string;
  password: string;
  gender: string;
  role: Role;
}) => {
  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
  });
  if (existingUser) {
    logger.warn("User already exists", { email: userData.email });
    throw new CustomError("User already exists", 409);
  }
  // Hash the password
  userData.password = await bcrypt.hash(userData.password, 10);
  // Create new user
  const user = await prisma.user.create({
    data: userData,
  });
  logger.info("Created new user", { user });
  return user;
};

export const updateUserById = async (
  userId: string,
  userData: {
    fullname: string;
    password?: string;
    role: Role;
    gender: string;
  }
) => {
  // Hash the password
  if (userData.password) {
    userData.password = await bcrypt.hash(userData.password, 10);
  } else {
    delete userData.password;
  }
  // Update user
  const user = await prisma.user.update({
    where: { id: userId },
    data: userData,
  });
  if (!user) {
    logger.warn("User not found for update", { userId });
    throw new CustomError("User not found", 404);
  }
  logger.info("Updated user", { userId, user });
  return user;
};

export const archiveUserById = async (userId: string) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });
  if (!user) {
    logger.warn("User not found for archiving", { userId });
    throw new CustomError("User not found", 404);
  }
  logger.info("Archived user", { userId, user });
  return { message: "User archived successfully" };
};

export const restoreUserById = async (userId: string) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });
  if (!user) {
    logger.warn("User not found for restoring", { userId });
    throw new CustomError("User not found", 404);
  }
  logger.info("Restored user", { userId, user });
  return { message: "User restored successfully" };
};

export const getProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    logger.warn("User profile not found", { userId });
    throw new CustomError("User profile not found", 404);
  }
  logger.info("Fetched user profile", { userId, user });
  return user;
};

export const updateProfile = async (
  userId: string,
  fullname: string,
  gender: string,
  avatarUrl?: string
) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });
  if (!user) {
    logger.warn("User not found for profile update", { userId });
    throw new CustomError("User not found", 404);
  }
  let uploadResult;

  // Handle avatar upload if provided
  if (avatarUrl) {
    // If user has an existing avatar, delete it from Cloudinary
    if (user.publicId) {
      await deleteImageFromCloudinary(user.publicId);
    }
    // Upload new avatar to Cloudinary
    uploadResult = await uploadImageToCloudinary(avatarUrl);
    avatarUrl = uploadResult?.secure_url;
  } else {
    avatarUrl = user.avatarUrl; // Keep existing avatar if not updated
  }

  // Update user profile
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      fullname: fullname || user.fullname,
      gender: gender || user.gender,
      avatarUrl,
      publicId: uploadResult?.public_id || user.publicId,
    },
  });

  logger.info("Updated user profile", { userId, updatedUser });
  return updatedUser;
};
