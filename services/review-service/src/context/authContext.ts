import { Request } from "express";
import jwt from "jsonwebtoken";
import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET as string;

export interface AuthenticatedUser {
  userId: string;
  role: string;
  fullname: string;
  avatarUrl: string;
  publicId: string;
}

export const buildContext = ({ req }: { req: Request }) => {
  const authHeader = req.headers.authorization;
  let user: AuthenticatedUser | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(
        token,
        ACCESS_TOKEN_SECRET
      ) as AuthenticatedUser;
      user = decoded;
    } catch (err) {
      logger.error(
        `Authentication error: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      throw new CustomError("Invalid or expired token", 401);
    }
  }

  return { user };
};
