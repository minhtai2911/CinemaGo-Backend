import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import { Redis } from "ioredis";
import helmet from "helmet";
import logger from "./utils/logger.js";
import bookingRoutes from "./routes/booking.routes.js";
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
const PORT = process.env.PORT || 8005;
const app = express();

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  "/api/bookings",
  (req: express.Request, res: express.Response, next: express.NextFunction) => {
    req.redisClient = redisClient;
    next();
  },
  bookingRoutes
);

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
