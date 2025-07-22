import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import notificationRoutes from "./routes/notification.routes.js";
import { connectRabbitMQ, subscribeToQueue } from "./utils/rabbitmq.js";
import { sendNotificationEmail } from "./services/notification.service.js";
import { errorHandler } from "./middlewares/errorHandler.js";

dotenv.config();
const PORT = process.env.PORT || 8009;
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

app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

async function startServer() {
  try {
    await connectRabbitMQ();

    await subscribeToQueue("email.send", sendNotificationEmail);

    app.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to connect to server", error);
    process.exit(1);
  }
}

startServer();
