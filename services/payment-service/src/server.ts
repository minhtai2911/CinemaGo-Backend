import express from "express";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import paymentRoutes from "./routes/payment.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();

const PORT = process.env.PORT || 8008;
const app = express();

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/payments", paymentRoutes);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
