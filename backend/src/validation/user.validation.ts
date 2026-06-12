import { z } from "zod";

const emailSchema = z
  .string()
  .trim()
  .email("Invalid email address")
  .min(1)
  .max(255)
  .transform((value) => value.toLowerCase());

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

const currentPasswordSchema = z.string().min(1).max(128);

const ianaTimeZoneNames = (() => {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };

  return new Set(intlWithSupportedValues.supportedValuesOf?.("timeZone") || []);
})();

const isValidIanaTimeZone = (value: string) => {
  if (!value || /^UTC[+-]/i.test(value)) {
    return false;
  }

  if (ianaTimeZoneNames.size > 0) {
    if (ianaTimeZoneNames.has(value)) {
      return true;
    }
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return value.includes("/");
  } catch {
    return false;
  }
};

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(255),
  bio: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => value || null),
  timezone: z
    .string()
    .trim()
    .refine(isValidIanaTimeZone, {
      message: "Timezone must be a valid IANA timezone name",
    }),
});

export const updateEmailSchema = z.object({
  email: emailSchema,
  currentPassword: currentPasswordSchema,
});

export const updatePasswordSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: passwordSchema,
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });
