import express from "express";
import * as cinemaController from "../controllers/cinema.controller.js";
import {
  authenticateRequest,
  authorizeRole,
} from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/public", cinemaController.getCinemas);
router.get("/public/:id", cinemaController.getCinemaById);
router.post(
  "/",
  authenticateRequest,
  authorizeRole("ADMIN"),
  cinemaController.createCinema
);
router.put(
  "/:id",
  authenticateRequest,
  authorizeRole("ADMIN"),
  cinemaController.updateCinemaById
);
router.put(
  "/:id/archive",
  authenticateRequest,
  authorizeRole("ADMIN"),
  cinemaController.archiveCinemaById
);
router.put(
  "/:id/restore",
  authenticateRequest,
  authorizeRole("ADMIN"),
  cinemaController.restoreCinemaById
);
router.get(
  "/dashboard/total-count",
  authenticateRequest,
  authorizeRole("ADMIN"),
  cinemaController.getTotalCinemasCount
);
router.post("/public/batch", cinemaController.getCinemasByIds);

export default router;
