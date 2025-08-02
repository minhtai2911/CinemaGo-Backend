import express from "express";
import * as ShowtimeController from "../controllers/showtime.controller.js";
import { authenticateRequest, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/public", ShowtimeController.getShowtimes);
router.get("/public/:id", ShowtimeController.getShowtimeById);
router.post("/", authenticateRequest, authorizeRole("ADMIN"), ShowtimeController.createShowtime);
router.put("/:id", authenticateRequest, authorizeRole("ADMIN"), ShowtimeController.updateShowtimeById);
router.put("/archive/:id", authenticateRequest, authorizeRole("ADMIN"), ShowtimeController.archiveShowtimeById);
router.put("/restore/:id", authenticateRequest, authorizeRole("ADMIN"), ShowtimeController.restoreShowtimeById);

export default router;
