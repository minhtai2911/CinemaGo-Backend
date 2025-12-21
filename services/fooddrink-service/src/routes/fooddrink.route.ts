import express from "express";
import * as fooddrinkController from "../controllers/fooddrink.controller.js";
import {
  authenticateRequest,
  authorizeRole,
} from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/public", fooddrinkController.getFoodDrinks);
router.get("/public/:id", fooddrinkController.getFoodDrinkById);
router.post(
  "/",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  upload.single("image"),
  fooddrinkController.createFoodDrink
);
router.put(
  "/:id",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  upload.single("image"),
  fooddrinkController.updateFoodDrinkById
);
router.put(
  "/:id/toggle-availability",
  authenticateRequest,
  authorizeRole("ADMIN", "MANAGER"),
  fooddrinkController.toggleFoodDrinkAvailability
);
router.post("/public/by-ids", fooddrinkController.getFoodDrinkByIds);

export default router;
