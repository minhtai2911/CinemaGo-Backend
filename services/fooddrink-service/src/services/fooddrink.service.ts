import logger from "../utils/logger.js";
import { CustomError } from "../utils/customError.js";
import prisma from "../config/db.js";
import { FoodDrinkType } from "../../generated/prisma/index.js";
import {
  uploadImageToCloudinary,
  deleteImageFromCloudinary,
} from "../utils/cloudinary.js";

export const getFoodDrinks = async ({
  page,
  limit,
  search = "",
  isAvailable,
}: {
  page?: number;
  limit?: number;
  search?: string;
  isAvailable?: boolean;
}) => {
  // Fetch food and drinks with pagination and search functionality
  const foodDrinks = await prisma.foodDrink.findMany({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(isAvailable !== undefined && { isAvailable }),
    },
    ...(page &&
      limit && {
        skip: (page - 1) * limit,
        take: limit,
      }),
  });

  // Count total items for pagination
  const totalItems = await prisma.foodDrink.count({
    where: {
      ...(search && {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(isAvailable !== undefined && { isAvailable }),
    },
  });

  logger.info("Fetched food and drinks", { foodDrinks, page, limit });
  return {
    foodDrinks,
    totalItems,
    totalPages: limit ? Math.ceil(totalItems / limit) : 1,
  };
};

export const getFoodDrinkById = async (foodDrinkId: string) => {
  // Fetch a food or drink item by its ID
  const foodDrink = await prisma.foodDrink.findUnique({
    where: { id: foodDrinkId },
  });
  // If food or drink item not found, throw a custom error
  if (!foodDrink) {
    logger.warn("Food or drink item not found", { foodDrinkId });
    throw new CustomError("Food or drink item not found", 404);
  }

  logger.info("Fetched food or drink item", { foodDrink });
  return foodDrink;
};

export const createFoodDrink = async (
  name: string,
  description: string,
  price: number,
  image: string,
  type: FoodDrinkType
) => {
  // Check if a food or drink item with the same name already exists
  const existingFoodDrink = await prisma.foodDrink.findUnique({
    where: { name },
  });

  // If it exists, throw a conflict error
  if (existingFoodDrink) {
    logger.warn("Food or drink item already exists", { name });
    throw new CustomError("Food or drink item already exists", 409);
  }

  try {
    // Upload image to Cloudinary
    const uploadResult = await uploadImageToCloudinary(image);

    if (!uploadResult) {
      throw new CustomError("Image upload failed", 500);
    }
    // Create a new food or drink item in the database
    const newFoodDrink = await prisma.foodDrink.create({
      data: {
        name,
        description,
        price,
        image: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        type,
      },
    });

    logger.info("Created new food or drink item", { newFoodDrink });
    return newFoodDrink;
  } catch (error) {
    // If there's an error during creation, delete the uploaded image from Cloudinary
    await deleteImageFromCloudinary(image);
    throw error;
  }
};

export const updateFoodDrinkById = async (
  foodDrinkId: string,
  data: {
    name?: string;
    description?: string;
    price?: number;
    image?: string;
    type?: FoodDrinkType;
  }
) => {
  const foodDrink = await prisma.foodDrink.findUnique({
    where: { id: foodDrinkId },
  });

  if (!foodDrink) {
    logger.warn("Food or drink item not found for update", { foodDrinkId });
    throw new CustomError("Food or drink item not found", 404);
  }

  let uploadResult;
  // Handle image upload if a new image is provided
  if (data.image) {
    // If there's an existing image, delete it from Cloudinary
    if (foodDrink.publicId) {
      await deleteImageFromCloudinary(foodDrink.publicId);
    }
    // Upload new image to Cloudinary
    uploadResult = await uploadImageToCloudinary(data.image);
    data.image = uploadResult?.secure_url;
  } else {
    data.image = foodDrink.image; // Keep existing image if not updated
  }
  // Update the food or drink item in the database
  const updatedFoodDrink = await prisma.foodDrink.update({
    where: { id: foodDrinkId },
    data: {
      name: data.name || foodDrink.name,
      description: data.description || foodDrink.description,
      price: data.price || foodDrink.price,
      image: data.image,
      type: data.type || foodDrink.type,
    },
  });

  logger.info("Updated food or drink item", { updatedFoodDrink });
  return updatedFoodDrink;
};

export const toggleFoodDrinkAvailability = async (foodDrinkId: string) => {
  // Fetch the food or drink item by its ID
  const foodDrink = await prisma.foodDrink.findUnique({
    where: { id: foodDrinkId },
  });
  // If not found, throw a custom error
  if (!foodDrink) {
    logger.warn("Food or drink item not found for toggling availability", {
      foodDrinkId,
    });
    throw new CustomError("Food or drink item not found", 404);
  }
  // Toggle the availability status
  const updatedFoodDrink = await prisma.foodDrink.update({
    where: { id: foodDrinkId },
    data: { isAvailable: !foodDrink.isAvailable },
  });

  logger.info("Toggled food or drink item availability", { updatedFoodDrink });
  return updatedFoodDrink;
};

export const getFoodDrinkByIds = async (foodDrinkIds: string[]) => {
  // Fetch multiple food or drink items by their IDs
  const foodDrinks = await prisma.foodDrink.findMany({
    where: { id: { in: foodDrinkIds } },
  });

  logger.info("Fetched food or drink items by IDs", { foodDrinks });
  return foodDrinks;
};
