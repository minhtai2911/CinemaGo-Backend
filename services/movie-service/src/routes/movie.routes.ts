import express from "express";
import * as MovieController from "../controllers/movie.controller.js";
import { verifyToken, authorizeRole } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/categories", MovieController.getCategories);
router.get("/", MovieController.getMovies);
router.get("/:movieId", MovieController.getMovieById);
router.post("/", verifyToken, authorizeRole("ADMIN"), upload.fields([{ name: "thumbnail" }, { name: "trailer" }]), MovieController.createMovie);
router.put("/:movieId", verifyToken, authorizeRole("ADMIN"), upload.fields([{ name: "thumbnail" }, { name: "trailer" }]), MovieController.updateMovieById);
router.delete("/:movieId", verifyToken, authorizeRole("ADMIN"), MovieController.deleteMovieById);
router.get("/categories/:categoryId", MovieController.getCategoryById);
router.post("/categories", verifyToken, authorizeRole("ADMIN"), MovieController.createCategory);
router.put("/categories/:categoryId", verifyToken, authorizeRole("ADMIN"), MovieController.updateCategoryById);
router.put("/categories/archive/:categoryId", verifyToken, authorizeRole("ADMIN"), MovieController.archiveCategoryById);
router.put("/categories/restore/:categoryId", verifyToken, authorizeRole("ADMIN"), MovieController.restoreCategoryById);

export default router;
