import { NextFunction, Request, Response, Router } from "express";
import passport from "passport";
import { config } from "../config/app.config";
import {
  getAuthConfigController,
  googleLoginCallback,
  loginController,
  logOutController,
  registerUserController,
} from "../controllers/auth.controller";
import {
  loginAuthRateLimiter,
  registerAuthRateLimiter,
  writeApiRateLimiter,
} from "../middlewares/rateLimit.middleware";
import isAuthenticated from "../middlewares/isAuthenticated.middleware";


const failedUrl = `${config.FRONTEND_GOOGLE_CALLBACK_URL}?status=failure`;

const authRoutes = Router();

const requireGoogleOAuth = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!config.GOOGLE_OAUTH_ENABLED) {
    res.status(503).json({
      message: "Google OAuth is not configured for this environment",
    });
    return;
  }

  next();
};

authRoutes.get("/config", getAuthConfigController);
authRoutes.post("/register", registerAuthRateLimiter, registerUserController);
authRoutes.post("/login", loginAuthRateLimiter, loginController);

authRoutes.post("/logout", isAuthenticated, writeApiRateLimiter, logOutController);


authRoutes.get(
  "/google",
  requireGoogleOAuth,
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

authRoutes.get(
  "/google/callback",
  requireGoogleOAuth,
  passport.authenticate("google", {
    failureRedirect: failedUrl,
  }),
  googleLoginCallback
);

export default authRoutes;
