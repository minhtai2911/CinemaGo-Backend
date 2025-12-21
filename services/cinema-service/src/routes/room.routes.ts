import express from "express";
import * as RoomController from "../controllers/room.controller.js";
import {
  authenticateRequest,
  authorizeRole,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/public", RoomController.getRooms);
router.get("/public/:id", RoomController.getRoomById);
router.post(
  "/",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  RoomController.createRoom
);
router.put(
  "/:id",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  RoomController.updateRoomById
);
router.put(
  "/archive/:id",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  RoomController.archiveRoomById
);
router.put(
  "/restore/:id",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  RoomController.restoreRoomById
);
router.post("/hold-seat", authenticateRequest, RoomController.holdSeat);
router.get(
  "/:showtimeId/hold-seat",
  authenticateRequest,
  RoomController.getHeldSeats
);
router.post("/release-seat", authenticateRequest, RoomController.releaseSeat);

export default router;
