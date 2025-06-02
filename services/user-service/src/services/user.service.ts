import prisma from "../config/db";
import logger from "../utils/logger";
import bcrypt from "bcrypt";
import { CustomError } from "../utils/customError";

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
      ...(role && { role }),
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
      ...(role && { role }),
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
  role: string;
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
  return { message: "User created successfully" };
};

export const updateUserById = async (
  userId: string,
  userData: {
    fullname: string;
    password?: string;
    role: string;
  }
) => {
  // Hash the password
  if (userData.password) {
    userData.password = await bcrypt.hash(userData.password, 10);
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
  return { message: "User updated successfully" };
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

export const unarchiveUserById = async (userId: string) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: true },
  });
  if (!user) {
    logger.warn("User not found for unarchiving", { userId });
    throw new CustomError("User not found", 404);
  }
  logger.info("Unarchived user", { userId, user });
  return { message: "User unarchived successfully" };
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
  profileData: {
    fullname?: string;
    avatarUrl?: string;
    publicId?: string;
  }
) => {
  const user = await prisma.user.update({
    where: { id: userId },
    data: profileData,
  });
  if (!user) {
    logger.warn("User not found for profile update", { userId });
    throw new CustomError("User not found", 404);
  }
  logger.info("Updated user profile", { userId, user });
  return { message: "Profile updated successfully" };
};
