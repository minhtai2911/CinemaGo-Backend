import Review from "../../models/review.js";
import axios from "axios";
import logger from "../../utils/logger.js";
import { CustomError } from "../../utils/customError.js";
import { AuthenticatedUser } from "../../context/authContext.js";

export const reviewResolver = {
  Query: {
    getReviews: async (
      _: any,
      {
        page,
        limit,
        movieId,
        rating,
        userId,
        type,
        status,
      }: {
        page?: number;
        limit?: number;
        movieId?: string;
        rating?: number;
        userId?: string;
        type?: string;
        status?: string;
      }
    ) => {
      const pageNumber = Number(page) || 1;
      const limitNumber = Number(limit) || 10;
      // Find reviews by movieId and optional rating
      const reviews = await Review.find({
        ...(movieId && { movieId }),
        ...(rating && {
          rating: { $gte: rating, $lt: rating + 1 },
        }),
        ...(userId && { userId }),
        ...(type && { type }),
        ...(status && { status }),
      })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);
      // Count total reviews for pagination
      const totalItems = await Review.countDocuments({
        ...(movieId && { movieId }),
        ...(rating && {
          rating: { $gte: rating, $lt: rating + 1 },
        }),
        ...(userId && { userId }),
        ...(type && { type }),
        ...(status && { status }),
      });
      // Calculate total pages
      const totalPages = Math.ceil(totalItems / limitNumber);
      logger.info(
        `Fetched ${reviews.length} reviews for page ${pageNumber} with limit ${limitNumber}`
      );
      // Return paginated response
      return {
        pagination: {
          totalItems,
          totalPages,
          currentPage: pageNumber,
          pageSize: limitNumber < totalItems ? limitNumber : totalItems,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
        },
        data: reviews,
      };
    },
    getReviewsById: async (_: any, { reviewId }: { reviewId: string }) => {
      // Check if reviewId is provided
      if (!reviewId) {
        logger.error("Review ID must be provided");
        throw new CustomError("Review ID must be provided", 400);
      }
      // Find review by ID
      const review = await Review.findById(reviewId);
      // Check if review exists
      if (!review) {
        logger.error(`Review with ID ${reviewId} not found`);
        throw new CustomError("Review not found", 404);
      }
      logger.info(`Fetched review with ID: ${reviewId}`);
      return review;
    },
  },

  Mutation: {
    createReview: async (
      _: any,
      {
        movieId,
        rating,
        content,
      }: {
        movieId: string;
        rating: number;
        content?: string;
      },
      context: { user?: AuthenticatedUser }
    ) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new CustomError("Unauthorized", 401);
      }
      const userId = context.user.userId;
      // Validate input
      if (!movieId || !rating) {
        throw new CustomError("Movie ID and rating must be provided", 400);
      }
      if (rating < 1 || rating > 5) {
        throw new CustomError("Rating must be between 1 and 5", 400);
      }
      // Check if user has already reviewed this movie
      const existingReview = await Review.findOne({
        userId,
        movieId,
      });
      if (existingReview) {
        throw new CustomError("You have already reviewed this movie", 400);
      }
      // Predict sentiment for the review content
      const response = await axios.post(
        `${process.env.SENTIMENT_SERVICE_URL}/api/predict-sentiment`,
        { text: content }
      );
      const label = response.data.label;
      let type: string;
      switch (label) {
        case "POS":
          type = "Tích cực";
          break;
        case "NEG":
          type = "Tiêu cực";
          break;
        case "NEU":
          type = "Trung lập";
          break;
        default:
          type = "Trung lập";
      }
      const review = new Review({
        userId,
        movieId,
        rating,
        content,
        type,
      });
      return await review.save();
    },

    replyToReview: async (
      _: any,
      {
        reviewId,
        content,
      }: {
        reviewId: string;
        content: string;
      },
      context: { user?: AuthenticatedUser }
    ) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new CustomError("Unauthorized", 401);
      }
      // Check if review exists
      const review = await Review.findById(reviewId);
      if (!review) throw new CustomError("Review not found", 404);
      // Validate content
      if (!content) {
        throw new CustomError("Content must be provided", 400);
      }
      // Add response to review
      review.response.push({
        userId: context.user?.userId,
        content,
        createdAt: new Date(),
      });
      if (context.user.role === "ADMIN") {
        review.status = "Đã trả lời";
      }
      return await review.save();
    },

    updateReviewById: async (
      _: any,
      {
        reviewId,
        content,
        rating,
      }: {
        reviewId: string;
        content: string;
        rating: number;
      },
      context: { user?: AuthenticatedUser }
    ) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new CustomError("Unauthorized", 401);
      }
      // Validate input
      if (!content && !rating) {
        throw new CustomError("Content or rating must be provided", 400);
      }
      // Find review by ID and check ownership
      const review = await Review.findById(reviewId);
      if (!review) throw new CustomError("Review not found", 404);
      if (review.userId !== context.user.userId) {
        throw new CustomError("You can only update your own reviews", 403);
      }
      // Update review content and rating
      review.content = content;
      review.rating = rating;
      review.updatedAt = new Date();
      // Predict sentiment for the updated content
      const response = await axios.post(
        `${process.env.SENTIMENT_SERVICE_URL}/api/predict-sentiment`,
        { text: content }
      );
      const label = response.data.label;
      switch (label) {
        case "POS":
          review.type = "Tích cực";
          break;
        case "NEG":
          review.type = "Tiêu cực";
          break;
        case "NEU":
          review.type = "Trung lập";
          break;
        default:
          review.type = "Trung lập";
      }

      return await review.save();
    },

    hideReviewById: async (
      _: any,
      { reviewId }: { reviewId: string },
      context: { user?: AuthenticatedUser }
    ) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new CustomError("Unauthorized", 401);
      }
      // Check if user is admin
      if (context.user.role !== "ADMIN") {
        throw new CustomError("Forbidden: Only admins can hide reviews", 403);
      }
      // Find review by ID
      const review = await Review.findById(reviewId);
      // Check if review exists
      if (!review) throw new CustomError("Review not found", 404);
      // Hide the review
      review.isActive = false;
      return await review.save();
    },

    unhideReviewById: async (
      _: any,
      { reviewId }: { reviewId: string },
      context: { user?: AuthenticatedUser }
    ) => {
      // Check if user is authenticated
      if (!context.user) {
        throw new CustomError("Unauthorized", 401);
      }
      // Check if user is admin
      if (context.user.role !== "ADMIN") {
        throw new CustomError("Forbidden: Only admins can unhide reviews", 403);
      }
      // Find review by ID
      const review = await Review.findById(reviewId);
      // Check if review exists
      if (!review) throw new CustomError("Review not found", 404);
      // Unhide the review
      review.isActive = true;
      return await review.save();
    },
  },
};
