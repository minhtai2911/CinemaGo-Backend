import express, { NextFunction, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { Redis } from "ioredis";
import bodyParser from "body-parser";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import logger from "./utils/logger.js";
import proxy from "express-http-proxy";
import { errorHandler } from "./middlewares/errorHandler.js";
import {
  verifyToken,
  AuthenticatedRequest,
} from "./middlewares/authMiddleware.js";
import { OutgoingHttpHeaders } from "http";

function sanitizeRequestBody(body: Record<string, any>): Record<string, any> {
  const sensitiveFields = [
    "password",
    "newPassword",
    "oldPassword",
    "token",
    "accessToken",
    "refreshToken",
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

const redisClient = new Redis(process.env.REDIS_URL as string);

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

const ratelimitOptions = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Sensitive endpoint rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({ success: false, message: "Too many requests" });
  },
  store: new RedisStore({
    sendCommand: async (...args: [string, ...string[]]) => {
      return (await redisClient.call(...args)) as any;
    },
  }),
});

app.use(ratelimitOptions);

app.use((req, res, next) => {
  logger.info(`Received ${req.method} request to ${req.url}`);
  const sanitizedBody = sanitizeRequestBody(req.body);
  logger.info(`Request body: ${JSON.stringify(sanitizedBody)}`);
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

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`API Gateway is running on port ${PORT}`);
  logger.info(`User Service URL: ${process.env.USER_SERVICE_URL}`);
  logger.info(`Movie Service URL: ${process.env.MOVIE_SERVICE_URL}`);
  logger.info(`Cinema Service URL: ${process.env.CINEMA_SERVICE_URL}`);
  logger.info(`Showtime Service URL: ${process.env.SHOWTIME_SERVICE_URL}`);
  logger.info(`Booking Service URL: ${process.env.BOOKING_SERVICE_URL}`);
  logger.info(`Sentiment Service URL: ${process.env.SENTIMENT_SERVICE_URL}`);
  logger.info(`Review Service URL: ${process.env.REVIEW_SERVICE_URL}`);
  logger.info(`Payment Service URL: ${process.env.PAYMENT_SERVICE_URL}`);
  logger.info(
    `Notification Service URL: ${process.env.NOTIFICATION_SERVICE_URL}`
  );
});
