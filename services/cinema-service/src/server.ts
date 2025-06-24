import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import cinemaRoutes from "./routes/cinema.routes.js";
import roomRoutes from "./routes/room.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();

const PORT = process.env.PORT || 8003;
const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/v1/cinemas", cinemaRoutes);
app.use("/api/v1/rooms", roomRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
