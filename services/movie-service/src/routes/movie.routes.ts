import express from "express";
import * as MovieController from "../controllers/movie.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/", MovieController.getMovies);
router.get("/:movieId", MovieController.getMovieById);
router.post(
  "/",
  verifyToken,
  authorizeRole("ADMIN"),
  upload.fields([{ name: "thumbnail" }, { name: "trailer" }]),
  MovieController.createMovie
);
router.put(
  "/:movieId",
  verifyToken,
  authorizeRole("ADMIN"),
  upload.fields([{ name: "thumbnail" }, { name: "trailer" }]),
  MovieController.updateMovieById
);
router.put(
  "/archive/:movieId",
  verifyToken,
  authorizeRole("ADMIN"),
  MovieController.archiveMovieById
);
router.put(
  "/restore/:movieId",
  verifyToken,
  authorizeRole("ADMIN"),
  MovieController.restoreMovieById
);

export default router;
