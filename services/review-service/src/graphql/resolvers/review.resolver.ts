import Review from "../../models/review.js";
import axios from "axios";
import logger from "../../utils/logger.js";
import { CustomError } from "../../utils/customError.js";
import { AuthenticatedUser } from "../../context/authContext.js";
import dotenv from "dotenv";
dotenv.config();

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
        isActive,
      }: {
        page?: number;
        limit?: number;
        movieId?: string;
        rating?: number;
        userId?: string;
        type?: string;
        status?: string;
        isActive?: boolean;
      },
    ) => {
      const pageNumber = Number(page) || undefined;
      const limitNumber = Number(limit) || undefined;

      const query: any = {
        ...(movieId && { movieId }),
        ...(rating && {
          rating: { $gte: Number(rating), $lt: Number(rating) + 1 },
        }),
        ...(userId && { userId }),
        ...(type && { type }),
        ...(status && { status }),
        ...(isActive !== undefined ? { isActive } : {}),
      };

      let mongooseQuery = Review.find(query).sort({ createdAt: -1 });

      if (pageNumber && limitNumber) {
        mongooseQuery = mongooseQuery
          .skip((pageNumber - 1) * limitNumber)
          .limit(limitNumber);
      }
      // Find reviews by movieId and optional rating
      const reviews = await mongooseQuery;

      reviews.forEach((review: any) => {
        if (Array.isArray(review.response)) {
          review.response.sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        }
      });

      // Count total reviews for pagination
      const totalItems = await Review.countDocuments(query);
      // Calculate total pages
      const totalPages = limitNumber ? Math.ceil(totalItems / limitNumber) : 1;
      logger.info(
        `Fetched ${reviews.length} reviews for page ${pageNumber} with limit ${limitNumber}`,
      );
      // Return paginated response
      return {
        pagination: {
          totalItems,
          totalPages,
          currentPage: pageNumber,
          pageSize: limitNumber || totalItems,
          hasNextPage: pageNumber ? pageNumber < totalPages : false,
          hasPrevPage: pageNumber ? pageNumber > 1 : false,
        },
        data: reviews,
      };
    },

    getReviewById: async (_: any, { reviewId }: { reviewId: string }) => {
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

    getReviewOverview: async (_: any, { movieId }: { movieId: string }) => {
      const movie = await axios
        .get(`${process.env.MOVIE_SERVICE_URL}/api/movies/public/${movieId}`)
        .then((res) => res.data)
        .catch(() => null);

      if (!movie) {
        throw new CustomError("Movie not found", 404);
      }

      const reviews = await Review.find({ movieId, isActive: true });

      const totalReviews = reviews.length;
      const averageRating =
        totalReviews > 0
          ? (
              reviews.reduce((sum, review) => sum + review.rating, 0) /
              totalReviews
            ).toFixed(1)
          : "0.0";

      const ratingDistribution = [0, 0, 0, 0, 0];
      reviews.forEach((review) => {
        const ratingIndex = Math.floor(review.rating) - 1;
        if (ratingIndex >= 0 && ratingIndex < ratingDistribution.length) {
          ratingDistribution[ratingIndex]++;
        }
      });

      return {
        totalReviews,
        averageRating,
        ratingDistribution,
      };
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
      context: { user?: AuthenticatedUser },
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
        throw new CustomError("Bạn đã đánh giá phim này rồi.", 409);
      }
      // Predict sentiment for the review content
      let type: string;
      try {
        const response = await axios.post(
          `${process.env.SENTIMENT_SERVICE_URL}/api/predict-sentiment`,
          { text: content },
        );
        const label = response.data.label;
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
            type = "Không khả dụng";
        }
      } catch (error) {
        logger.warn("Sentiment prediction failed", { error });
        type = "Không khả dụng";
      }
      try {
        const totalReviews = await Review.countDocuments({ movieId });

        const review = new Review({
          userId,
          movieId,
          rating,
          content,
          type,
          userDetail: {
            fullname: context.user.fullname,
            avatarUrl: context.user.avatarUrl,
          },
        });

        await review.save();

        await axios.post(
          `${process.env.MOVIE_SERVICE_URL}/api/movies/calculate-movie-rating`,
          {
            movieId,
            rating,
            totalReviews,
          },
        );

        logger.info("Review created and movie rating updated successfully", {
          movieId,
          reviewId: review._id,
        });

        return review;
      } catch (error) {
        logger.error("Failed to create review and update movie rating", {
          error,
          movieId,
        });

        throw new CustomError(
          "Failed to create review and update movie rating",
          500,
        );
      }
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
      context: { user?: AuthenticatedUser },
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
        userDetail: {
          fullname: context.user.fullname,
          avatarUrl: context.user.avatarUrl,
        },
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
      context: { user?: AuthenticatedUser },
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
      try {
        const response = await axios.post(
          `${process.env.SENTIMENT_SERVICE_URL}/api/predict-sentiment`,
          { text: content },
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
      } catch (error) {
        logger.warn("Sentiment prediction failed", { error });
        review.type = "Không khả dụng";
      }
      return await review.save();
    },

    hideReviewById: async (
      _: any,
      { reviewId }: { reviewId: string },
      context: { user?: AuthenticatedUser },
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
      context: { user?: AuthenticatedUser },
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
