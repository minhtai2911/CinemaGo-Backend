import express from "express";
import * as ShowtimeController from "../controllers/showtime.controller.js";
import {
  authenticateRequest,
  authorizeRole,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/public", ShowtimeController.getShowtimes);
router.get("/public/get-busy-rooms", ShowtimeController.getBusyRoomIds);
router.get("/public/:id", ShowtimeController.getShowtimeById);
router.post(
  "/",
  authenticateRequest,
  authorizeRole("MANAGER", "ADMIN"),
  ShowtimeController.createShowtime
);
router.put(
  "/:id",
  authenticateRequest,
  authorizeRole("MANAGER", "ADMIN"),
  ShowtimeController.updateShowtimeById
);
router.put(
  "/archive/:id",
  authenticateRequest,
  authorizeRole("MANAGER", "ADMIN"),
  ShowtimeController.archiveShowtimeById
);
router.put(
  "/restore/:id",
  authenticateRequest,
  authorizeRole("MANAGER", "ADMIN"),
  ShowtimeController.restoreShowtimeById
);
router.post("/public/batch", ShowtimeController.getShowtimesByIds);
router.get("/public/health-check", ShowtimeController.healthCheck);

export default router;
