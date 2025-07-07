import express from "express";
import * as ShowtimeController from "../controllers/showtime.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", ShowtimeController.getShowtimes);
router.get("/:id", ShowtimeController.getShowtimeById);
router.post("/", verifyToken, authorizeRole("ADMIN"), ShowtimeController.createShowtime);
router.put("/:id", verifyToken, authorizeRole("ADMIN"), ShowtimeController.updateShowtimeById);
router.put("/archive/:id", verifyToken, authorizeRole("ADMIN"), ShowtimeController.archiveShowtimeById);
router.put("/restore/:id", verifyToken, authorizeRole("ADMIN"), ShowtimeController.restoreShowtimeById);

export default router;
