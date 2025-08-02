import express from "express";
import * as GenresController from "../controllers/genres.controller.js";
import { authenticateRequest, authorizeRole } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/public", GenresController.getGenres);
router.get("/public/:genreId", GenresController.getGenreById);
router.post("/", authenticateRequest, authorizeRole("ADMIN"), GenresController.createGenre);
router.put("/:genreId", authenticateRequest, authorizeRole("ADMIN"), GenresController.updateGenreById);
router.put("/archive/:genreId", authenticateRequest, authorizeRole("ADMIN"), GenresController.archiveGenreById);
router.put("/restore/:genreId", authenticateRequest, authorizeRole("ADMIN"), GenresController.restoreGenreById);

export default router;