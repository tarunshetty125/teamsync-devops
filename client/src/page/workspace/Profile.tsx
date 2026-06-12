import { ChangeEvent, useEffect, useMemo, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader, Upload } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { NotificationSettings } from "@/components/notifications/notification-center";
import WorkspaceHeader from "@/components/workspace/common/workspace-header";
import { useAuthContext } from "@/context/auth-provider";
import { toast } from "@/hooks/use-toast";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { getApiAssetUrl } from "@/lib/base-url";
import {
  getAccountSummaryQueryFn,
  updateEmailMutationFn,
  updatePasswordMutationFn,
  updateProfileMutationFn,
  uploadAvatarMutationFn,
} from "@/lib/api";

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(255),
  bio: z.string().trim().max(500, "Bio must be 500 characters or fewer"),
  timezone: z.string().trim().min(1, "Timezone is required"),
});

const emailSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  currentPassword: z.string().min(1, "Current password is required").max(128),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required").max(128),
    newPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password must be at most 128 characters")
      .regex(/[a-z]/, "Password must include a lowercase letter")
      .regex(/[A-Z]/, "Password must include an uppercase letter")
      .regex(/[0-9]/, "Password must include a number")
      .regex(/[^A-Za-z0-9]/, "Password must include a special character"),
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different",
    path: ["newPassword"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type EmailFormValues = z.infer<typeof emailSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

const fallbackTimezones = [
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

const getTimezoneOptions = () => {
  const intlWithSupportedValues = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const supported = intlWithSupportedValues.supportedValuesOf?.("timeZone");

  return supported?.length ? supported : fallbackTimezones;
};

const getInitials = (name?: string) => {
  const parts = name?.trim().split(/\s+/).filter(Boolean) || [];

  return `${parts[0]?.charAt(0) || ""}${parts[1]?.charAt(0) || ""}` || "U";
};

function ProfileSection() {
  const { user, refetchAuth } = useAuthContext();
  const workspaceId = useWorkspaceId();
  const queryClient = useQueryClient();
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const timezoneOptions = useMemo(getTimezoneOptions, []);
  const browserTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  const defaultTimezone = timezoneOptions.includes(browserTimezone)
    ? browserTimezone
    : timezoneOptions[0];

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      bio: "",
      timezone: defaultTimezone,
    },
  });

  useEffect(() => {
    if (user) {
      form.reset({
        name: user.name || "",
        bio: user.bio || "",
        timezone: user.timezone || defaultTimezone,
      });
    }
  }, [defaultTimezone, form, user]);

  const updateProfile = useMutation({
    mutationFn: updateProfileMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      refetchAuth();
      toast({
        title: "Profile updated",
        description: "Your profile details have been saved.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Profile update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadAvatar = useMutation({
    mutationFn: uploadAvatarMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
      refetchAuth();
      toast({
        title: "Avatar updated",
        description: "Your profile picture has been updated.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Avatar upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || uploadAvatar.isPending) return;

    uploadAvatar.mutate({ workspaceId, file });
  };

  const onSubmit = (values: ProfileFormValues) => {
    updateProfile.mutate({
      name: values.name,
      bio: values.bio,
      timezone: values.timezone,
    });
  };

  return (
    <section className="py-5">
      <div className="mb-5 border-b pb-2">
        <h2 className="text-[17px] font-semibold">Profile</h2>
      </div>

      <div className="mb-6 flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={getApiAssetUrl(user?.profilePicture)} />
          <AvatarFallback>{getInitials(user?.name)}</AvatarFallback>
        </Avatar>
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={uploadAvatar.isPending}
            onClick={() => avatarInputRef.current?.click()}
          >
            {uploadAvatar.isPending ? (
              <Loader className="animate-spin" />
            ) : (
              <Upload />
            )}
            Upload avatar
          </Button>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input className="h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio</FormLabel>
                <FormControl>
                  <Textarea rows={5} maxLength={500} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="timezone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Timezone</FormLabel>
                <FormControl>
                  <select
                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                    {...field}
                  >
                    {timezoneOptions.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="flex place-self-end"
            disabled={updateProfile.isPending}
          >
            {updateProfile.isPending && <Loader className="animate-spin" />}
            Save profile
          </Button>
        </form>
      </Form>
    </section>
  );
}

function AccountSection() {
  const { user, refetchAuth } = useAuthContext();
  const queryClient = useQueryClient();

  const accountQuery = useQuery({
    queryKey: ["account-summary"],
    queryFn: getAccountSummaryQueryFn,
  });

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: {
      email: "",
      currentPassword: "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  useEffect(() => {
    if (user?.email) {
      emailForm.setValue("email", user.email);
    }
  }, [emailForm, user?.email]);

  const refreshAccount = () => {
    queryClient.invalidateQueries({ queryKey: ["authUser"] });
    queryClient.invalidateQueries({ queryKey: ["account-summary"] });
    refetchAuth();
  };

  const updateEmail = useMutation({
    mutationFn: updateEmailMutationFn,
    onSuccess: () => {
      emailForm.setValue("currentPassword", "");
      refreshAccount();
      toast({
        title: "Email updated",
        description: "Your email has been changed.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Email update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updatePassword = useMutation({
    mutationFn: updatePasswordMutationFn,
    onSuccess: () => {
      passwordForm.reset();
      refreshAccount();
      toast({
        title: "Password updated",
        description: "Your password has been changed.",
        variant: "success",
      });
    },
    onError: (error) => {
      toast({
        title: "Password update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const hasPassword = accountQuery.data?.hasPassword ?? false;
  const providers = accountQuery.data?.providers || [];

  return (
    <section className="py-5">
      <div className="mb-5 border-b pb-2">
        <h2 className="text-[17px] font-semibold">Account</h2>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-medium">Connected providers</h3>
        <div className="flex flex-wrap gap-2">
          {accountQuery.isLoading ? (
            <span className="text-sm text-muted-foreground">Loading...</span>
          ) : providers.length > 0 ? (
            providers.map((provider) => (
              <Badge key={provider} variant="secondary">
                {provider}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              No connected providers.
            </span>
          )}
        </div>
      </div>

      <div className="space-y-8">
        <Form {...emailForm}>
          <form
            onSubmit={emailForm.handleSubmit((values) =>
              updateEmail.mutate(values)
            )}
            className="space-y-4"
          >
            <h3 className="text-sm font-medium">Email</h3>
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input className="h-11" disabled={!hasPassword} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={emailForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      type="password"
                      disabled={!hasPassword}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="flex place-self-end"
              disabled={!hasPassword || updateEmail.isPending}
            >
              {updateEmail.isPending && <Loader className="animate-spin" />}
              Change email
            </Button>
          </form>
        </Form>

        <Form {...passwordForm}>
          <form
            onSubmit={passwordForm.handleSubmit((values) =>
              updatePassword.mutate(values)
            )}
            className="space-y-4"
          >
            <h3 className="text-sm font-medium">Password</h3>
            <FormField
              control={passwordForm.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current password</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      type="password"
                      disabled={!hasPassword}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={passwordForm.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <FormControl>
                    <Input
                      className="h-11"
                      type="password"
                      disabled={!hasPassword}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="flex place-self-end"
              disabled={!hasPassword || updatePassword.isPending}
            >
              {updatePassword.isPending && <Loader className="animate-spin" />}
              Change password
            </Button>
          </form>
        </Form>
      </div>
    </section>
  );
}

function NotificationSection() {
  const workspaceId = useWorkspaceId();

  return (
    <section className="py-5">
      <div className="mb-5 border-b pb-2">
        <h2 className="text-[17px] font-semibold">Notifications</h2>
      </div>
      <NotificationSettings workspaceId={workspaceId} />
    </section>
  );
}

export default function Profile() {
  return (
    <div className="w-full h-auto py-2">
      <WorkspaceHeader />
      <Separator className="my-4" />
      <main>
        <div className="w-full max-w-3xl mx-auto py-3">
          <h1 className="mb-1 text-[20px] font-semibold leading-[30px]">
            Profile settings
          </h1>
          <ProfileSection />
          <Separator />
          <AccountSection />
          <Separator />
          <NotificationSection />
        </div>
      </main>
    </div>
  );
}
