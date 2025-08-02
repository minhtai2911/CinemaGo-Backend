import express from "express";
import * as MovieController from "../controllers/movie.controller.js";
import { authenticateRequest, authorizeRole } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/public", MovieController.getMovies);
router.get("/public/:movieId", MovieController.getMovieById);
router.post(
  "/",
  authenticateRequest,
  authorizeRole("ADMIN"),
  upload.fields([{ name: "thumbnail" }, { name: "trailer" }]),
  MovieController.createMovie
);
router.put(
  "/:movieId",
  authenticateRequest,
  authorizeRole("ADMIN"),
  upload.fields([{ name: "thumbnail" }, { name: "trailer" }]),
  MovieController.updateMovieById
);
router.put(
  "/archive/:movieId",
  authenticateRequest,
  authorizeRole("ADMIN"),
  MovieController.archiveMovieById
);
router.put(
  "/restore/:movieId",
  authenticateRequest,
  authorizeRole("ADMIN"),
  MovieController.restoreMovieById
);

export default router;
