import express from "express";
import * as GenresController from "../controllers/genres.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/", GenresController.getGenres);
router.get("/:genreId", GenresController.getGenreById);
router.post("/", verifyToken, authorizeRole("ADMIN"), GenresController.createGenre);
router.put("/:genreId", verifyToken, authorizeRole("ADMIN"), GenresController.updateGenreById);
router.put("/archive/:genreId", verifyToken, authorizeRole("ADMIN"), GenresController.archiveGenreById);
router.put("/restore/:genreId", verifyToken, authorizeRole("ADMIN"), GenresController.restoreGenreById);

export default router;