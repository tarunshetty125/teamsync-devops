import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  CheckCheck,
  FileText,
  Folder,
  Loader,
  MessageSquare,
  Trash2,
  UserPlus,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Permissions } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { toast } from "@/hooks/use-toast";
import {
  deleteNotificationMutationFn,
  getNotificationPreferencesQueryFn,
  getNotificationsQueryFn,
  getUnreadNotificationCountQueryFn,
  markAllNotificationsReadMutationFn,
  markNotificationReadMutationFn,
  updateNotificationPreferencesMutationFn,
} from "@/lib/api";
import {
  NotificationItemType,
  NotificationPreferenceMapType,
  NotificationTypeEnumType,
} from "@/types/api.type";

const notificationLabels: Array<{
  type: NotificationTypeEnumType;
  label: string;
}> = [
  { type: "TASK_ASSIGNED", label: "Task assigned" },
  { type: "TASK_UPDATED", label: "Task updates" },
  { type: "MENTION_RECEIVED", label: "Mentions" },
  { type: "COMMENT_ADDED", label: "Comments" },
  { type: "PROJECT_CREATED", label: "Projects" },
  { type: "INVITE_ACCEPTED", label: "Invites" },
  { type: "FILE_UPLOADED", label: "Files" },
];

const iconByCategory = {
  TASK: CheckCheck,
  PROJECT: Folder,
  COMMENT: MessageSquare,
  INVITE: UserPlus,
  SYSTEM: Bell,
};

const getNotificationPath = (
  workspaceId: string,
  notification: NotificationItemType
) => {
  if (notification.metadata?.path) {
    return notification.metadata.path;
  }

  if (notification.metadata?.projectId) {
    return `/workspace/${workspaceId}/project/${notification.metadata.projectId}`;
  }

  return `/workspace/${workspaceId}`;
};

function NotificationRow({
  notification,
  onOpen,
  onDelete,
  isDeleting,
}: {
  notification: NotificationItemType;
  onOpen: (notification: NotificationItemType) => void;
  onDelete: (notification: NotificationItemType) => void;
  isDeleting: boolean;
}) {
  const Icon = iconByCategory[notification.category] || Bell;
  const unread = !notification.readAt;

  return (
    <button
      type="button"
      onClick={() => onOpen(notification)}
      className="group flex w-full items-start gap-3 border-b py-3 text-left last:border-0 hover:bg-muted/50"
    >
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">
            {notification.title}
          </span>
          {unread && <span className="h-2 w-2 rounded-full bg-primary" />}
        </span>
        <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {notification.body}
        </span>
        <span className="mt-1 block text-[11px] text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100"
        disabled={isDeleting}
        onClick={(event) => {
          event.stopPropagation();
          onDelete(notification);
        }}
      >
        {isDeleting ? <Loader className="animate-spin" /> : <Trash2 />}
        <span className="sr-only">Delete notification</span>
      </Button>
    </button>
  );
}

export function NotificationSettings({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const queryClient = useQueryClient();
  const settingsQueryKey = ["notification-preferences", workspaceId];

  const { data, isLoading } = useQuery({
    queryKey: settingsQueryKey,
    queryFn: () => getNotificationPreferencesQueryFn(workspaceId),
    enabled: Boolean(workspaceId),
  });

  const updatePreferences = useMutation({
    mutationFn: updateNotificationPreferencesMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: settingsQueryKey });
    },
    onError: (error) => {
      toast({
        title: "Notification settings failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const preferences = data?.preferences;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading settings...</p>;
  }

  return (
    <div className="space-y-1">
      {notificationLabels.map((item) => (
        <label
          key={item.type}
          className="flex min-h-11 items-center justify-between gap-3 border-b py-2 text-sm last:border-0"
        >
          <span>{item.label}</span>
          <Checkbox
            checked={preferences?.[item.type] ?? true}
            disabled={updatePreferences.isPending}
            onCheckedChange={(checked) => {
              updatePreferences.mutate({
                workspaceId,
                preferences: {
                  [item.type]: Boolean(checked),
                } as Partial<NotificationPreferenceMapType>,
              });
            }}
            aria-label={`${item.label} notifications`}
          />
        </label>
      ))}
    </div>
  );
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthContext();
  const canManageNotificationSettings = hasPermission(
    Permissions.MANAGE_NOTIFICATION_SETTINGS
  );

  const listQueryKey = ["notifications", workspaceId, pageSize];
  const unreadQueryKey = ["notifications-unread-count", workspaceId];

  const unreadQuery = useQuery({
    queryKey: unreadQueryKey,
    queryFn: () => getUnreadNotificationCountQueryFn(workspaceId),
    enabled: Boolean(workspaceId),
    refetchInterval: 60000,
  });

  const notificationsQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: () =>
      getNotificationsQueryFn({
        workspaceId,
        pageNumber: 1,
        pageSize,
      }),
    enabled: Boolean(workspaceId && open),
  });

  const unreadCount = unreadQuery.data?.unreadCount || 0;
  const notifications = notificationsQuery.data?.notifications || [];
  const pagination = notificationsQuery.data?.pagination;

  const invalidateNotifications = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] });
    queryClient.invalidateQueries({ queryKey: unreadQueryKey });
  };

  const markRead = useMutation({
    mutationFn: markNotificationReadMutationFn,
    onSuccess: invalidateNotifications,
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsReadMutationFn,
    onSuccess: invalidateNotifications,
    onError: (error) => {
      toast({
        title: "Mark all read failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteNotification = useMutation({
    mutationFn: deleteNotificationMutationFn,
    onSuccess: invalidateNotifications,
    onSettled: () => setDeletingId(null),
    onError: (error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleOpenNotification = async (notification: NotificationItemType) => {
    try {
      if (!notification.readAt) {
        await markRead.mutateAsync({
          workspaceId,
          notificationId: notification._id,
        });
      }

      setOpen(false);
      navigate(getNotificationPath(workspaceId, notification));
    } catch (error) {
      toast({
        title: "Notification failed",
        description:
          error instanceof Error ? error.message : "Unable to open notification",
        variant: "destructive",
      });
    }
  };

  const hasMore = useMemo(
    () => Boolean(pagination && pageSize < pagination.totalCount),
    [pageSize, pagination]
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
      >
        <Bell />
        {unreadCount > 0 && (
          <Badge className="absolute -right-1 -top-1 h-5 min-w-5 justify-center px-1 text-[10px]">
            {unreadCount > 99 ? "99+" : unreadCount}
          </Badge>
        )}
        <span className="sr-only">Notifications</span>
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col p-0 sm:max-w-md">
          <div className="border-b px-5 py-4">
            <div className="flex items-center justify-between gap-3 pr-8">
              <div>
                <h2 className="text-base font-semibold">Notifications</h2>
                <p className="text-xs text-muted-foreground">
                  {unreadCount} unread
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={markAllRead.isPending || unreadCount === 0}
                onClick={() => markAllRead.mutate(workspaceId)}
              >
                <CheckCheck />
                Mark all read
              </Button>
            </div>
          </div>

          <Tabs defaultValue="inbox" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="mx-5 mt-4 grid grid-cols-2">
              <TabsTrigger value="inbox">Inbox</TabsTrigger>
              <TabsTrigger
                value="settings"
                disabled={!canManageNotificationSettings}
              >
                Settings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="inbox" className="min-h-0 flex-1 px-5">
              {notificationsQuery.isLoading ? (
                <div className="flex h-28 items-center justify-center text-sm text-muted-foreground">
                  <Loader className="mr-2 animate-spin" />
                  Loading notifications...
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex h-28 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                  <FileText className="h-5 w-5" />
                  No notifications yet.
                </div>
              ) : (
                <div className="max-h-[calc(100svh-220px)] overflow-y-auto">
                  {notifications.map((notification) => (
                    <NotificationRow
                      key={notification._id}
                      notification={notification}
                      onOpen={handleOpenNotification}
                      onDelete={(item) => {
                        setDeletingId(item._id);
                        deleteNotification.mutate({
                          workspaceId,
                          notificationId: item._id,
                        });
                      }}
                      isDeleting={deletingId === notification._id}
                    />
                  ))}
                  {hasMore && (
                    <div className="py-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full"
                        onClick={() => setPageSize((value) => value + 20)}
                      >
                        Load more notifications
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="settings" className="px-5 pb-5">
              <NotificationSettings workspaceId={workspaceId} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
