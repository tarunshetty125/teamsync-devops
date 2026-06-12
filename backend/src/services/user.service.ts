import mongoose from "mongoose";
import { ProviderEnum } from "../enums/account-provider.enum";
import {
  AuditActionEnum,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";
import AccountModel from "../models/account.model";
import UserModel, { UserDocument } from "../models/user.model";
import { RequestContext } from "../types/request-context";
import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from "../utils/appError";
import { recordAuditLog } from "./audit-log.service";

type UserActionContext = Omit<RequestContext, "workspaceId">;

type UpdateProfileInput = {
  name: string;
  bio: string | null;
  timezone: string;
};

type UpdateEmailInput = {
  email: string;
  currentPassword: string;
};

type UpdatePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

const isDuplicateKeyError = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === 11000;

const userActionContext = (
  user: Pick<UserDocument, "currentWorkspace">,
  context: UserActionContext
): RequestContext => {
  const workspaceId = user.currentWorkspace?.toString();

  if (!workspaceId) {
    throw new BadRequestException("Current workspace is required");
  }

  return {
    ...context,
    workspaceId,
  };
};

const getUserOrThrow = async (userId: string) => {
  const user = await UserModel.findById(userId)
    .populate("currentWorkspace")
    .select("-password");

  if (!user) {
    throw new BadRequestException("User not found");
  }

  return user;
};

export const getCurrentUserService = async (userId: string) => {
  const user = await getUserOrThrow(userId);

  return {
    user,
  };
};

export const getAccountSummaryService = async (userId: string) => {
  const [accounts, user] = await Promise.all([
    AccountModel.find({ userId }).select("provider").lean(),
    UserModel.findById(userId).select("+password").lean(),
  ]);

  if (!user) {
    throw new BadRequestException("User not found");
  }

  const providers = Array.from(
    new Set(accounts.map((account) => account.provider as string))
  ).sort();

  return {
    providers,
    hasPassword:
      Boolean(user.password) && providers.includes(ProviderEnum.EMAIL),
  };
};

export const updateProfileService = async (
  userId: string,
  context: UserActionContext,
  input: UpdateProfileInput
) => {
  const user = await UserModel.findById(userId);

  if (!user) {
    throw new BadRequestException("User not found");
  }

  const before = {
    name: user.name,
    bio: user.bio,
    timezone: user.timezone,
  };

  user.name = input.name;
  user.bio = input.bio;
  user.timezone = input.timezone;
  await user.save();

  await recordAuditLog(userActionContext(user, context), {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.USER,
    entityId: user._id.toString(),
    before,
    after: {
      name: user.name,
      bio: user.bio,
      timezone: user.timezone,
    },
    metadata: {
      scope: "profile",
    },
  });

  return getCurrentUserService(userId);
};

export const updateEmailService = async (
  userId: string,
  context: UserActionContext,
  input: UpdateEmailInput
) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  let committed = false;

  try {
    const user = await UserModel.findById(userId)
      .select("+password")
      .session(session);

    if (!user) {
      throw new BadRequestException("User not found");
    }

    if (!user.password) {
      throw new BadRequestException(
        "Email/password account is required to change email"
      );
    }

    const isCurrentPasswordValid = await user.comparePassword(
      input.currentPassword
    );

    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const existingUser = await UserModel.findOne({
      email: input.email,
      _id: { $ne: user._id },
    }).session(session);

    if (existingUser) {
      throw new BadRequestException("Email already exists");
    }

    const emailAccount = await AccountModel.findOne({
      userId: user._id,
      provider: ProviderEnum.EMAIL,
    }).session(session);

    if (!emailAccount) {
      throw new BadRequestException(
        "Email/password account is required to change email"
      );
    }

    const previousEmail = user.email;
    user.email = input.email;
    emailAccount.providerId = input.email;

    await user.save({ session });
    await emailAccount.save({ session });
    await session.commitTransaction();
    committed = true;

    await recordAuditLog(userActionContext(user, context), {
      action: AuditActionEnum.UPDATED,
      entityType: DomainEntityTypeEnum.USER,
      entityId: user._id.toString(),
      before: {
        email: previousEmail,
      },
      after: {
        email: user.email,
      },
      metadata: {
        scope: "account",
        action: "email_changed",
      },
    });

    return getCurrentUserService(userId);
  } catch (error) {
    if (!committed) {
      await session.abortTransaction();
    }

    if (isDuplicateKeyError(error)) {
      throw new BadRequestException("Email already exists");
    }

    throw error;
  } finally {
    session.endSession();
  }
};

export const updatePasswordService = async (
  userId: string,
  context: UserActionContext,
  input: UpdatePasswordInput
) => {
  const user = await UserModel.findById(userId).select("+password");

  if (!user) {
    throw new BadRequestException("User not found");
  }

  const emailAccount = await AccountModel.findOne({
    userId: user._id,
    provider: ProviderEnum.EMAIL,
  });

  if (!user.password || !emailAccount) {
    throw new BadRequestException(
      "Email/password account is required to change password"
    );
  }

  const isCurrentPasswordValid = await user.comparePassword(
    input.currentPassword
  );

  if (!isCurrentPasswordValid) {
    throw new UnauthorizedException("Current password is incorrect");
  }

  user.password = input.newPassword;
  await user.save();

  await recordAuditLog(userActionContext(user, context), {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.USER,
    entityId: user._id.toString(),
    metadata: {
      scope: "account",
      action: "password_changed",
    },
  });

  return { message: "Password updated successfully" };
};
