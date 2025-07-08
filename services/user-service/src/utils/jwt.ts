import jwt from "jsonwebtoken";
import prisma from "../config/db.js";
import logger from "./logger.js";

export const generateTokens = async (
  userId: string,
  role: string,
  avatarUrl: string,
  publicId: string
) => {
  // Create access and refresh tokens
  const accessToken = jwt.sign(
    {
      userId: userId,
      role: role,
      avatarUrl: avatarUrl,
      publicId: publicId,
    },
    process.env.ACCESS_TOKEN_SECRET || "defaultAccessTokenSecret",
    { expiresIn: "60m" }
  );

  const refreshToken = jwt.sign(
    {
      userId: userId,
      role: role,
      avatarUrl: avatarUrl,
      publicId: publicId,
    },
    process.env.REFRESH_TOKEN_SECRET || "defaultRefreshTokenSecret",
    { expiresIn: "7d" }
  );
  // Check if tokens were generated successfully
  if (!accessToken || !refreshToken) {
    throw new Error("Failed to generate tokens");
  }
  // Delete any existing refresh token for the user
  await prisma.refreshToken.deleteMany({
    where: { userId },
  });
  // Store the refresh token in the database
  await prisma.refreshToken.create({
    data: {
      userId,
      token: refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    },
  });

  logger.info("Tokens generated successfully", {
    userId,
    accessToken,
    refreshToken,
  });
  return { accessToken, refreshToken };
};
