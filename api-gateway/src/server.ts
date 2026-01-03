import express, { NextFunction, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Redis } from "ioredis";
import helmet from "helmet";
import logger from "./utils/logger.js";
import proxy from "express-http-proxy";
import { errorHandler } from "./middlewares/errorHandler.js";
import {
  verifyToken,
  AuthenticatedRequest,
} from "./middlewares/authMiddleware.js";
import { OutgoingHttpHeaders } from "http";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";

function sanitizeRequestBody(body: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    "password",
    "newPassword",
    "oldPassword",
    "token",
    "accessToken",
    "refreshToken",
    "otp",
  ];
  return Object.keys(body).reduce((sanitized, key) => {
    if (!sensitiveFields.includes(key)) {
      sanitized[key] = body[key];
    }
    return sanitized;
  }, {} as Record<string, any>);
}

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

const redisClient = new Redis(process.env.REDIS_URL as string, {
  retryStrategy: (times) => Math.min(times * 50, 2000),
});

const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  path: "/socket.io",
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? [process.env.URL_USER as string, process.env.URL_ADMIN as string]
        : ["http://localhost:3000", "http://localhost:3001"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

const pubClient = redisClient.duplicate();
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

io.on("connection", (socket) => {
  logger.info("New WebSocket client connected", {
    socketId: socket.id,
    ip: socket.handshake.address,
  });

  socket.on("join-showtime", (showtimeId: string) => {
    socket.join(`showtime:${showtimeId}`);
    logger.info("Client joined showtime room", {
      showtimeId,
      socketId: socket.id,
    });
  });

  socket.on("leave-showtime", (showtimeId: string) => {
    socket.leave(`showtime:${showtimeId}`);
    logger.info("Client left showtime room", {
      showtimeId,
      socketId: socket.id,
    });
  });

  socket.on("disconnect", (reason) => {
    logger.info("Client disconnected", { socketId: socket.id, reason });
  });
});

const SEAT_EVENT_CHANNEL = "seat-update-channel";

const subscriber = redisClient.duplicate();
subscriber.subscribe(SEAT_EVENT_CHANNEL, (err) => {
  if (err) {
    logger.error("Failed to subscribe to seat-update-channel", { error: err });
  } else {
    logger.info("Gateway subscribed to Redis channel: seat-update-channel");
  }
});

subscriber.on("message", (channel, message) => {
  if (channel !== SEAT_EVENT_CHANNEL) {
    return;
  }

  try {
    const event = JSON.parse(message);
    if (!event.showtimeId || !event.seatId || !event.status) {
      return;
    }

    io.to(`showtime:${event.showtimeId}`).emit("seat-update", {
      showtimeId: event.showtimeId,
      seatId: event.seatId,
      status: event.status, // "held" | "booked" | "released"
      expiresAt: event.expiresAt || null,
    });

    logger.debug("Forwarded seat update to clients", event);
  } catch (err) {
    logger.error("Invalid seat event from Redis", { message, error: err });
  }
});

app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [process.env.URL_USER as string, process.env.URL_ADMIN as string]
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  if (req.body) {
    const sanitizedBody = sanitizeRequestBody(req.body);
    logger.info(`Request body: ${JSON.stringify(sanitizedBody)}`);
  }
  next();
});

const proxyOptions = {
  proxyReqPathResolver: (req: AuthenticatedRequest) => {
    return req.originalUrl.replace(/^\/v1/, "/api");
  },
  proxyErrorHandler: (err: Error, res: Response, next: NextFunction) => {
    logger.error(`Proxy error: ${err.message}`);
    res.status(500).json({
      message: `Internal server error`,
      error: err.message,
    });
  },
};

app.use(
  "/v1/auth",
  verifyToken,
  proxy(process.env.USER_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/users",
  verifyToken,
  proxy(process.env.USER_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/movies",
  verifyToken,
  proxy(process.env.MOVIE_SERVICE_URL as string, {
    ...proxyOptions,
    limit: "100mb",
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/genres",
  verifyToken,
  proxy(process.env.MOVIE_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/cinemas",
  verifyToken,
  proxy(process.env.CINEMA_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/rooms",
  verifyToken,
  proxy(process.env.CINEMA_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/showtimes",
  verifyToken,
  proxy(process.env.SHOWTIME_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/bookings",
  verifyToken,
  proxy(process.env.BOOKING_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/predict-sentiment",
  verifyToken,
  proxy(process.env.SENTIMENT_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/reviews",
  proxy(process.env.REVIEW_SERVICE_URL as string, {
    ...proxyOptions,
  })
);

app.use(
  "/v1/payments",
  verifyToken,
  proxy(process.env.PAYMENT_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/notifications",
  verifyToken,
  proxy(process.env.NOTIFICATION_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.use(
  "/v1/food-drinks",
  verifyToken,
  proxy(process.env.FOOD_DRINK_SERVICE_URL as string, {
    ...proxyOptions,
    proxyReqOptDecorator: (proxyReqOpts: any, srcReq: AuthenticatedRequest) => {
      proxyReqOpts.headers ||= {};

      const headers = proxyReqOpts.headers as OutgoingHttpHeaders;

      if (srcReq.user?.userId) {
        headers["x-user-id"] = srcReq.user.userId;
        headers["x-user-role"] = srcReq.user.role;
      }

      return {
        ...proxyReqOpts,
        headers,
      };
    },
  })
);

app.get("/health", (_req, res) => {
  res.json({
    status: "OK",
    gateway: "running",
    redis: redisClient.status,
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

httpServer.listen(PORT, () => {
  logger.info(`API Gateway + Real-time Engine running on port ${PORT}`);
  logger.info(`Redis channel: ${SEAT_EVENT_CHANNEL}`);
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received. Shutting down gracefully...");
  httpServer.close(() => {
    redisClient.quit();
    pubClient.quit();
    subClient.quit();
    subscriber.quit();
    process.exit(0);
  });
});
