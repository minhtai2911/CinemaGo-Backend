import express from "express";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import dotenv from "dotenv";
import bodyParser from "body-parser";
import helmet from "helmet";
import logger from "./utils/logger.js";
import userRoutes from "./routes/user.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

declare global {
  namespace Express {
    interface Request {
      io?: SocketIOServer;
    }
  }
}
export const userSocketMap = new Map<string, string>();
dotenv.config();

const PORT = process.env.PORT || 8001;
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

app.use(helmet());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use("/api/v1/users", userRoutes);
app.use("/api/v1/auth", authRoutes);

io.on("connection", (socket) => {
  socket.on("verify-user", (userId) => {
    userSocketMap.set(userId, socket.id);
    logger.info("User verified for socket", { userId, socketId: socket.id });
  });

  socket.on("disconnect", () => {
    for (let [uid, sid] of userSocketMap.entries()) {
      if (sid === socket.id) {
        userSocketMap.delete(uid);
        break;
      }
    }
    logger.info("Socket disconnected", { socketId: socket.id });
  });
});

app.use(errorHandler);

server.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
});
