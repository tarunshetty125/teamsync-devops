import { describe, expect, it } from "vitest";
import AccountModel from "../src/models/account.model";
import AuditLogModel from "../src/models/audit-log.model";
import UserModel from "../src/models/user.model";
import WorkspaceModel from "../src/models/workspace.model";
import { ProviderEnum } from "../src/enums/account-provider.enum";
import {
  loginOrCreateAccountService,
  registerUserService,
  verifyUserService,
} from "../src/services/auth.service";
import {
  getAccountSummaryService,
  getCurrentUserService,
  updateEmailService,
  updatePasswordService,
  updateProfileService,
} from "../src/services/user.service";
import { updateProfileSchema } from "../src/validation/user.validation";

const password = "Str0ng!Pass";

const registerUser = async (email: string, name = "Profile User") => {
  const result = await registerUserService({
    email,
    name,
    password,
  });

  const user = await UserModel.findById(result.userId);
  const workspace = await WorkspaceModel.findById(result.workspaceId);

  if (!user || !workspace) {
    throw new Error("Expected user and workspace to exist");
  }

  return {
    user,
    workspace,
    context: {
      requestId: `${user._id.toString()}-${workspace._id.toString()}`,
      userId: user._id.toString(),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    },
  };
};

describe("user profile and account services", () => {
  it("updates profile fields and reserves preferences without profile behavior", async () => {
    const { user, context } = await registerUser("profile@example.com");

    const { user: updatedUser } = await updateProfileService(
      user._id.toString(),
      context,
      {
        name: "Updated Profile",
        bio: "Building TeamSync.",
        timezone: "Asia/Kolkata",
      }
    );

    expect(updatedUser.name).toBe("Updated Profile");
    expect(updatedUser.bio).toBe("Building TeamSync.");
    expect(updatedUser.timezone).toBe("Asia/Kolkata");
    expect(updatedUser.preferences).toEqual({});
    expect(await AuditLogModel.countDocuments({ entityId: user._id })).toBe(1);
  });

  it("accepts only valid IANA timezone names", () => {
    expect(() =>
      updateProfileSchema.parse({
        name: "Timezone User",
        bio: "",
        timezone: "Asia/Kolkata",
      })
    ).not.toThrow();

    expect(() =>
      updateProfileSchema.parse({
        name: "Timezone User",
        bio: "",
        timezone: "America/New_York",
      })
    ).not.toThrow();

    expect(() =>
      updateProfileSchema.parse({
        name: "Timezone User",
        bio: "",
        timezone: "UTC+5:30",
      })
    ).toThrow(/iana timezone/i);
  });

  it("changes email transactionally without invalidating the current user", async () => {
    const { user, context } = await registerUser("email-old@example.com");

    const { user: updatedUser } = await updateEmailService(
      user._id.toString(),
      context,
      {
        email: "email-new@example.com",
        currentPassword: password,
      }
    );

    expect(updatedUser.email).toBe("email-new@example.com");
    expect(
      await AccountModel.exists({
        provider: ProviderEnum.EMAIL,
        providerId: "email-new@example.com",
        userId: user._id,
      })
    ).toBeTruthy();
    await expect(
      verifyUserService({
        email: "email-new@example.com",
        password,
      })
    ).resolves.toMatchObject({ email: "email-new@example.com" });

    const audit = await AuditLogModel.findOne({ entityId: user._id }).lean();
    expect(audit?.before).toEqual({ email: "email-old@example.com" });
    expect(audit?.after).toEqual({ email: "email-new@example.com" });
    expect(JSON.stringify(audit)).not.toContain(password);
  });

  it("rejects duplicate email and incorrect current password", async () => {
    const { user, context } = await registerUser("email-owner@example.com");
    await registerUser("email-existing@example.com");

    await expect(
      updateEmailService(user._id.toString(), context, {
        email: "email-existing@example.com",
        currentPassword: password,
      })
    ).rejects.toThrow(/email already exists/i);

    await expect(
      updateEmailService(user._id.toString(), context, {
        email: "email-newer@example.com",
        currentPassword: "wrong-password",
      })
    ).rejects.toThrow(/current password/i);
  });

  it("changes passwords for email accounts and never writes password values to audit logs", async () => {
    const { user, context } = await registerUser("password@example.com");
    const newPassword = "Str0nger!Pass2";

    await updatePasswordService(user._id.toString(), context, {
      currentPassword: password,
      newPassword,
    });

    await expect(
      verifyUserService({
        email: "password@example.com",
        password: newPassword,
      })
    ).resolves.toMatchObject({ email: "password@example.com" });

    const audit = await AuditLogModel.findOne({ entityId: user._id }).lean();
    expect(audit?.metadata).toMatchObject({ action: "password_changed" });
    expect(JSON.stringify(audit)).not.toContain(password);
    expect(JSON.stringify(audit)).not.toContain(newPassword);
  });

  it("returns provider visibility without exposing provider identifiers", async () => {
    const { user } = await registerUser("providers@example.com");

    await AccountModel.create({
      userId: user._id,
      provider: ProviderEnum.GOOGLE,
      providerId: "google-provider-id",
    });

    const account = await getAccountSummaryService(user._id.toString());

    expect(account.providers).toEqual(
      expect.arrayContaining([ProviderEnum.EMAIL, ProviderEnum.GOOGLE])
    );
    expect(account.hasPassword).toBe(true);
    expect(account).not.toHaveProperty("accounts");
    expect(JSON.stringify(account)).not.toContain("google-provider-id");
  });

  it("rejects password and email changes for OAuth-only users", async () => {
    const { user } = await loginOrCreateAccountService({
      provider: ProviderEnum.GOOGLE,
      providerId: "oauth-only-google-id",
      displayName: "OAuth Only",
      email: "oauth-only@example.com",
    });
    const current = await getCurrentUserService(user._id.toString());
    const context = {
      requestId: "oauth-only",
      userId: user._id.toString(),
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    };

    expect(current.user.email).toBe("oauth-only@example.com");
    expect(await getAccountSummaryService(user._id.toString())).toMatchObject({
      providers: [ProviderEnum.GOOGLE],
      hasPassword: false,
    });

    await expect(
      updatePasswordService(user._id.toString(), context, {
        currentPassword: password,
        newPassword: "Str0nger!Pass2",
      })
    ).rejects.toThrow(/email\/password account/i);

    await expect(
      updateEmailService(user._id.toString(), context, {
        email: "oauth-new@example.com",
        currentPassword: password,
      })
    ).rejects.toThrow(/email\/password account/i);
  });
});
