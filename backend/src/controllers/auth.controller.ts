import { NextFunction, Request, Response } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { config } from "../config/app.config";
import { loginSchema, registerSchema } from "../validation/auth.validation";
import { HTTPSTATUS } from "../config/http.config";
import { registerUserService } from "../services/auth.service";
import passport from "passport";
import { InternalServerException } from "../utils/appError";
import {
  createSessionRecord,
  revokeCurrentSessionRecord,
} from "../services/session-registry.service";
import { ProviderEnum } from "../enums/account-provider.enum";

export const googleLoginCallback = asyncHandler(
  async (req: Request, res: Response) => {
    const currentWorkspace = req.user?.currentWorkspace;
    const userId = req.user?._id?.toString();

    if (!currentWorkspace || !userId) {
      return res.redirect(
        `${config.FRONTEND_GOOGLE_CALLBACK_URL}?status=failure`
      );
    }

    await createSessionRecord(req, userId, ProviderEnum.GOOGLE);

    return res.redirect(
      `${config.FRONTEND_ORIGINS[0]}/workspace/${currentWorkspace}`
    );
  }
);

export const getAuthConfigController = asyncHandler(
  async (_req: Request, res: Response) => {
    res.status(HTTPSTATUS.OK).json({
      googleOAuthEnabled: config.GOOGLE_OAUTH_ENABLED,
    });
  }
);

export const registerUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const body = registerSchema.parse({
      ...req.body,
    });

    await registerUserService(body);

    return res.status(HTTPSTATUS.CREATED).json({
      message: "User created successfully",
    });
  }
);

export const loginController = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    req.body = loginSchema.parse(req.body);

    passport.authenticate(
      "local",
      (
        err: Error | null,
        user: Express.User | false,
        info: { message: string } | undefined
      ) => {
        if (err) {
          return next(err);
        }

        if (!user) {
          return res.status(HTTPSTATUS.UNAUTHORIZED).json({
            message: info?.message || "Invalid email or password",
          });
        }

        req.logIn(user, (err) => {
          if (err) {
            return next(err);
          }

          createSessionRecord(req, user._id.toString(), ProviderEnum.EMAIL)
            .then(() =>
              res.status(HTTPSTATUS.OK).json({
                message: "Logged in successfully",
                user,
              })
            )
            .catch(next);
        });
      }
    )(req, res, next);
  }
);

export const logOutController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id?.toString();
    if (userId) {
      await revokeCurrentSessionRecord(req, userId);
    }

    await new Promise<void>((resolve, reject) => {
      req.logout((err) => {
        if (err) {
          reject(new InternalServerException("Failed to log out"));
          return;
        }

        resolve();
      });
    });

    req.session = null;
    res.clearCookie(config.CSRF_COOKIE_NAME, { path: "/" });

    return res
      .status(HTTPSTATUS.OK)
      .json({ message: "Logged out successfully" });
  }
);
