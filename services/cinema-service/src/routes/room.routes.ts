import express from "express";
import * as RoomController from "../controllers/room.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", RoomController.getRooms);
router.get("/:id", RoomController.getRoomById);
router.post(
  "/",
  verifyToken,
  authorizeRole("ADMIN"),
  RoomController.createRoom
);
router.put(
  "/:id",
  verifyToken,
  authorizeRole("ADMIN"),
  RoomController.updateRoomById
);
router.delete(
  "/:id",
  verifyToken,
  authorizeRole("ADMIN"),
  RoomController.deleteRoomById
);

export default router;
