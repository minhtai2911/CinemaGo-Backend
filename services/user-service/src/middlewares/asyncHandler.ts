import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.js";

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      await fn(req, res, next);
    } catch (err) {
      logger.error(
        `Async error: ${err instanceof Error ? err.message : String(err)}`
      );
      next(err);
    }
  };
};
