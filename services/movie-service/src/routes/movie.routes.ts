import express from "express";
import * as MovieController from "../controllers/movie.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/genres", MovieController.getGenres);
router.get("/", MovieController.getMovies);
router.get("/:movieId", MovieController.getMovieById);
router.post("/", verifyToken, authorizeRole("ADMIN"), upload.fields([{ name: "thumbnail" }, { name: "trailer" }]), MovieController.createMovie);
router.put("/:movieId", verifyToken, authorizeRole("ADMIN"), upload.fields([{ name: "thumbnail" }, { name: "trailer" }]), MovieController.updateMovieById);
router.delete("/:movieId", verifyToken, authorizeRole("ADMIN"), MovieController.deleteMovieById);
router.get("/genres/:genreId", MovieController.getGenreById);
router.post("/genres", verifyToken, authorizeRole("ADMIN"), MovieController.createGenre);
router.put("/genres/:genreId", verifyToken, authorizeRole("ADMIN"), MovieController.updateGenreById);
router.put("/genres/archive/:genreId", verifyToken, authorizeRole("ADMIN"), MovieController.archiveGenreById);
router.put("/genres/restore/:genreId", verifyToken, authorizeRole("ADMIN"), MovieController.restoreGenreById);

export default router;
