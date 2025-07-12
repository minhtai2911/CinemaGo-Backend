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

        getReviewsById(reviewId: ID!): Review!
    }

    type Mutation {
        createReview(
            movieId: String!
            rating: Float!
            content: String
        ): Review!

        replyToReview(
            reviewId: ID!
            content: String!
        ): Review!

        updateReviewById(
            reviewId: ID!
            content: String
            rating: Float
        ): Review!

        hideReviewById(reviewId: ID!): Review!
        unhideReviewById(reviewId: ID!): Review!
    }
`;
