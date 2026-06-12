import rateLimit from "express-rate-limit";
import { Request, Response } from "express";
import { HTTPSTATUS } from "../config/http.config";
import { ErrorCodeEnum } from "../enums/error-code.enum";
import { config } from "../config/app.config";

const skipInTests = () => config.NODE_ENV === "test";

export const generalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    message: "Too many requests. Please try again later.",
    errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED,
  },
});

const authRateLimitHandler = (_req: Request, res: Response) => {
  res.status(HTTPSTATUS.TOO_MANY_REQUESTS).json({
    message: "Too many authentication attempts. Please try again later.",
    errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED,
  });
};

export const loginAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: authRateLimitHandler,
});

export const registerAuthRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  handler: authRateLimitHandler,
});

export const writeApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    message: "Too many write requests. Please try again later.",
    errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED,
  },
});

export const uploadRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    message: "Too many upload requests. Please try again later.",
    errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED,
  },
});

export const searchRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    message: "Too many search requests. Please try again later.",
    errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED,
  },
});

export const exportRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests,
  message: {
    message: "Too many export requests. Please try again later.",
    errorCode: ErrorCodeEnum.ACCESS_UNAUTHORIZED,
  },
});
