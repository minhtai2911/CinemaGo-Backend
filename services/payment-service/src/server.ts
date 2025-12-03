import express from "express";
import { Redis } from "ioredis";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import paymentRoutes from "./routes/payment.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();

declare global {
  namespace Express {
    interface Request {
      redisClient?: Redis;
    }
  }
}

const redisClient = new Redis(process.env.REDIS_URL as string);
const PORT = process.env.PORT || 8008;
const app = express();

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  "/api/payments",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.redisClient = redisClient;
    next();
  },
  paymentRoutes
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
