import { v2 as cloudinary } from "cloudinary";
import logger from "./logger.js";
import { CustomError } from "./customError.js";
import dotenv from "dotenv";
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadImageToCloudinary = async (url: string) => {
  try {
    const uploadResult = await cloudinary.uploader.upload(url, {
      folder: "food_drinks",
      transformation: [
        {
          width: 300,
          height: 300,
          crop: "fill",
          gravity: "face",
          quality: "auto",
          fetch_format: "auto",
        },
      ],
    });
    return uploadResult;
  } catch (err) {
    logger.error("Error uploading image to Cloudinary", {
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof Error && "http_code" in err) {
      throw new CustomError(
        `Cloudinary error ${err["http_code"]}: ${err.message}`
      );
    }
  }
};

export const deleteImageFromCloudinary = async (publicId: string) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      invalidate: true,
    });
    return result;
  } catch (err) {
    logger.error("Error deleting image from Cloudinary", {
      error: err instanceof Error ? err.message : String(err),
    });
    if (err instanceof Error && "http_code" in err) {
      throw new CustomError(
        `Cloudinary error ${err["http_code"]}: ${err.message}`
      );
    }
  }
};
