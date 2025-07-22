import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const authenticateRequest = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const userId = req.headers["x-user-id"] as string;
  const role = req.headers["x-user-role"] as string;

  if (!userId || !role) {
    logger.warn(`Access attempted without user ID`);
    res.status(401).json({
      message: "Authentication required! Please login to continue",
    });
    return;
  }

  req.user = { userId, role };
  next();
};

export const authorizeRole = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      res.status(403).json({ message: "Forbidden: Insufficient permissions" });
      return;
    }

    next();
  };
};
