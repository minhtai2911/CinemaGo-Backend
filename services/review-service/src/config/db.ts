import mongoose from "mongoose";
import dotenv from "dotenv";
import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";

dotenv.config();

export const connectDB = async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new CustomError(
        "DATABASE_URL is not defined in environment variables",
        500
      );
    }
    await mongoose.connect(process.env.DATABASE_URL as string);
    logger.info("MongoDB connected successfully");
  } catch (err) {
    logger.error(
      `MongoDB connection error: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
    throw new CustomError("Database connection error", 500);
  }
};
