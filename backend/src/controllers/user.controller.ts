import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { asyncHandler } from "../middlewares/asyncHandler.middleware";
import { HTTPSTATUS } from "../config/http.config";
import {
  getAccountSummaryService,
  getCurrentUserService,
  updateEmailService,
  updatePasswordService,
  updateProfileService,
} from "../services/user.service";
import { UnauthorizedException } from "../utils/appError";
import {
  updateEmailSchema,
  updatePasswordSchema,
  updateProfileSchema,
} from "../validation/user.validation";

const buildUserActionContext = (req: Request) => ({
  requestId: req.get("x-request-id") || req.get("x-correlation-id") || uuidv4(),
  userId: (() => {
    const userId = req.user?._id?.toString();

    if (!userId) {
      throw new UnauthorizedException("Authenticated user context is required");
    }

    return userId;
  })(),
  ipAddress: req.ip || req.socket.remoteAddress || "",
  userAgent: req.get("user-agent") || "",
});

export const getCurrentUserController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;

    const { user } = await getCurrentUserService(userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "User fetch successfully",
      user,
    });
  }
);

export const getAccountSummaryController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const result = await getAccountSummaryService(userId);

    return res.status(HTTPSTATUS.OK).json({
      message: "Account fetched successfully",
      ...result,
    });
  }
);

export const updateProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = updateProfileSchema.parse(req.body);
    const { user } = await updateProfileService(
      userId,
      buildUserActionContext(req),
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Profile updated successfully",
      user,
    });
  }
);

export const updateEmailController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = updateEmailSchema.parse(req.body);
    const { user } = await updateEmailService(
      userId,
      buildUserActionContext(req),
      body
    );

    return res.status(HTTPSTATUS.OK).json({
      message: "Email updated successfully",
      user,
    });
  }
);

export const updatePasswordController = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = req.user?._id;
    const body = updatePasswordSchema.parse(req.body);
    const result = await updatePasswordService(
      userId,
      buildUserActionContext(req),
      body
    );

    return res.status(HTTPSTATUS.OK).json(result);
  }
);
