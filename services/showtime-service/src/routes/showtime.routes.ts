import express from "express";
import * as ShowtimeController from "../controllers/showtime.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", ShowtimeController.getShowtimes);
router.get("/:id", ShowtimeController.getShowtimeById);
router.post("/", verifyToken, authorizeRole("ADMIN"), ShowtimeController.createShowtime);
router.put("/:id", verifyToken, authorizeRole("ADMIN"), ShowtimeController.updateShowtimeById);
router.delete("/:id", verifyToken, authorizeRole("ADMIN"), ShowtimeController.deleteShowtimeById);

export default router;
