export const reviewTypeDef = `#graphql
    type PaginatedReviews {
        pagination: Pagination!
        data: [Review!]!
    }

    type Pagination {
        totalItems: Int!
        totalPages: Int!
        currentPage: Int!
        pageSize: Int!
        hasNextPage: Boolean!
        hasPrevPage: Boolean!
    }

    type Response {
        userId: String!
        content: String!
        createdAt: String!
    }

    type Review {
        id: ID!
        userId: String!
        movieId: String!
        rating: Float!
        content: String
        status: String
        response: [Response!]
        isActive: Boolean!
        type: String!
        createdAt: String!
        updatedAt: String!
    }

    type Query {
        getReviews(
            page: Int
            limit: Int
            movieId: String
            rating: Float
            userId: String
            type: String
            status: String
        ): PaginatedReviews!

        getReviewById(reviewId: String!): Review!
    }

    type Mutation {
        createReview(
            movieId: String!
            rating: Float!
            content: String
        ): Review!

        replyToReview(
            reviewId: String!
            content: String!
        ): Review!

        updateReviewById(
            reviewId: String!
            content: String
            rating: Float
        ): Review!

        hideReviewById(reviewId: String!): Review!
        unhideReviewById(reviewId: String!): Review!
    }
`;
