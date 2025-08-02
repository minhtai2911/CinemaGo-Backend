import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.js";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  logger.error(
    `Error in error handler: ${
      err instanceof Error ? err.message : String(err)
    }`,
    {
      stack: err instanceof Error ? err.stack : undefined,
    }
  );
  res.status(500).json({ error: "Internal Server Error" });
};
