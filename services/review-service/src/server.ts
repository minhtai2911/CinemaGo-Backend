import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import logger from "./utils/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { ApolloServer } from "@apollo/server";
import { reviewTypeDef } from "./graphql/typeDefs/review.typeDef.js";
import { reviewResolver } from "./graphql/resolvers/review.resolver.js";
import { connectDB } from "./config/db.js";
import { expressMiddleware } from "@as-integrations/express5";
import { buildContext } from "./context/authContext.js";

dotenv.config();

const PORT = process.env.PORT || 8001;
const app = express();

await connectDB();

app.use(
  cors({
    origin: process.env.FRONTEND_URL as string,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const server = new ApolloServer({
  typeDefs: [reviewTypeDef],
  resolvers: [reviewResolver],
  introspection: true,
});

await server.start();

app.use(
  "/api/reviews",
  expressMiddleware(server, {
    context: async ({ req }) => {
      return buildContext({ req });
    },
  })
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server ready at http://localhost:${PORT}/api/reviews`);
});
