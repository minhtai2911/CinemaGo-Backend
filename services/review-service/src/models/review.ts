import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
    },
    movieId: {
      type: String,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
    },
    content: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      default: "Chưa trả lời",
      enum: ["Chưa trả lời", "Đã trả lời", "REPLIED", "UNREPLIED"],
    },
    response: [
      {
        userDetail: {
          fullname: {
            type: String,
            required: false,
          },
          avatarUrl: {
            type: String,
            required: false,
          },
        },
        userId: {
          type: String,
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "Tiêu cực",
        "Tích cực",
        "Trung lập",
        "POSITIVE",
        "NEGATIVE",
        "NEUTRAL",
        "Không khả dụng",
        "UNAVAILABLE",
      ],
    },
    userDetail: {
      fullname: {
        type: String,
        required: false,
      },
      avatarUrl: {
        type: String,
        required: false,
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Review", reviewSchema);
