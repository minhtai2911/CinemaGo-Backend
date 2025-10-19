import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import fooddrinkRoutes from "./routes/fooddrink.route.js";

dotenv.config();

const PORT = process.env.PORT || 8010;
const app = express();

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/food-drinks", fooddrinkRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
