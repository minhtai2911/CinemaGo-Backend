import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { CustomError } from "../utils/customError";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err instanceof CustomError) {
    logger.error(`Custom error: ${err.message}`, {
      statusCode: err.statusCode,
      stack: err.stack,
    });
    res.status(err.statusCode).json({ error: err.message });
  } else {
    logger.error(
      `Error in error handler: ${
        err instanceof Error ? err.message : String(err)
      }`,
      {
        stack: err instanceof Error ? err.stack : undefined,
      }
    );
    res.status(500).json({ error: "Internal Server Error" });
  }
};
