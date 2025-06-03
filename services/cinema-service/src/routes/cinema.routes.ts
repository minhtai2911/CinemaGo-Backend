import express from "express";
import * as cinemaController from "../controllers/cinema.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", cinemaController.getCinemas);
router.get("/:id", cinemaController.getCinemaById);
router.post(
  "/",
  verifyToken,
  authorizeRole("ADMIN"),
  cinemaController.createCinema
);
router.put(
  "/:id",
  verifyToken,
  authorizeRole("ADMIN"),
  cinemaController.updateCinemaById
);
router.put(
  "/:id/archive",
  verifyToken,
  authorizeRole("ADMIN"),
  cinemaController.archiveCinemaById
);
router.put(
  "/:id/restore",
  verifyToken,
  authorizeRole("ADMIN"),
  cinemaController.restoreCinemaById
);

export default router;
