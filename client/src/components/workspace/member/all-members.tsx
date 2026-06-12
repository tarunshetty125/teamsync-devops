import { ChevronDown, Loader, Trash2, UserX } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getAvatarColor, getAvatarFallbackText } from "@/lib/helper";
import { useAuthContext } from "@/context/auth-provider";
import useWorkspaceId from "@/hooks/use-workspace-id";
import useGetWorkspaceMembers from "@/hooks/api/use-get-workspace-members";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  assignMemberRoleMutationFn,
  deactivateMemberMutationFn,
  removeMemberMutationFn,
} from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { Permissions } from "@/constant";
import PresenceIndicator from "@/components/realtime/presence-indicator";
const AllMembers = () => {
  const { user, hasPermission } = useAuthContext();

  const canChangeMemberRole = hasPermission(Permissions.MANAGE_ROLES);
  const canRemoveMember = hasPermission(Permissions.REMOVE_MEMBER);

  const queryClient = useQueryClient();
  const workspaceId = useWorkspaceId();

  const { data, isPending } = useGetWorkspaceMembers(workspaceId);
  const members = data?.members || [];
  const roles = data?.roles || [];

  const { mutate, isPending: isLoading } = useMutation({
    mutationFn: assignMemberRoleMutationFn,
  });
  const deactivateMember = useMutation({ mutationFn: deactivateMemberMutationFn });
  const removeMember = useMutation({ mutationFn: removeMemberMutationFn });

  const handleSelect = (roleId: string, memberId: string) => {
    if (!roleId || !memberId) return;
    const payload = {
      workspaceId,
      roleId,
      memberId,
    };
    mutate(payload, {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: ["members", workspaceId],
        });
        toast({
          title: "Success",
        description: "Member's role changed successfully",
          variant: "success",
        });
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="grid gap-6 pt-2">
      {isPending ? (
        <Loader className="w-8 h-8 animate-spin place-self-center flex" />
      ) : null}

      {members?.map((member) => {
        const name = member.userId?.name;
        const initials = getAvatarFallbackText(name);
        const avatarColor = getAvatarColor(name);
        const isCurrentUser = member.userId._id === user?._id;
        return (
          <div
            key={member._id}
            className="flex items-center justify-between space-x-4"
          >
            <div className="flex items-center space-x-4">
              <Avatar className="h-8 w-8">
                <AvatarImage
                  src={member.userId?.profilePicture || ""}
                  alt="Image"
                />
                <AvatarFallback className={avatarColor}>
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-none">{name}</p>
                  <PresenceIndicator userId={member.userId._id} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {member.userId.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.status || "ACTIVE"} · {member.capacityHoursPerWeek ?? 40}h/week · Joined{" "}
                  {member.joinedAt
                    ? new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(member.joinedAt))
                    : "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Last active{" "}
                  {member.lastActiveAt
                    ? new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "numeric",
                      }).format(new Date(member.lastActiveAt))
                    : "Never"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto min-w-24 capitalize disabled:opacity-95 disabled:pointer-events-none"
                    disabled={
                      isLoading ||
                      !canChangeMemberRole ||
                      isCurrentUser ||
                      member.role.name === "OWNER"
                    }
                  >
                    {member.role.name?.toLowerCase()}{" "}
                    {canChangeMemberRole && !isCurrentUser && member.role.name !== "OWNER" && (
                      <ChevronDown className="text-muted-foreground" />
                    )}
                  </Button>
                </PopoverTrigger>
                {canChangeMemberRole && (
                  <PopoverContent className="p-0" align="end">
                    <Command>
                      <CommandInput
                        placeholder="Select new role..."
                        disabled={isLoading}
                        className="disabled:pointer-events-none"
                      />
                      <CommandList>
                        {isLoading ? (
                          <Loader className="w-8 h-8 animate-spin place-self-center flex my-4" />
                        ) : (
                          <>
                            <CommandEmpty>No roles found.</CommandEmpty>
                            <CommandGroup>
                              {roles?.map(
                                (role) =>
                                  role.name !== "OWNER" && (
                                    <CommandItem
                                      key={role._id}
                                      disabled={isLoading}
                                      className="disabled:pointer-events-none gap-1 mb-1  flex flex-col items-start px-4 py-2 cursor-pointer"
                                      onSelect={() => {
                                        handleSelect(
                                          role._id,
                                          member._id
                                        );
                                      }}
                                    >
                                      <p className="capitalize">
                                        {role.name?.toLowerCase()}
                                      </p>
                                      <p className="text-sm text-muted-foreground">
                                        {role.name === "ADMIN" &&
                                          `Can view, create, edit tasks, project and manage settings .`}

                                        {role.name === "MEMBER" &&
                                          `Can view,edit only task created by.`}
                                      </p>
                                    </CommandItem>
                                  )
                              )}
                            </CommandGroup>
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                )}
              </Popover>
              {canRemoveMember && !isCurrentUser && member.role.name !== "OWNER" && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    disabled={deactivateMember.isPending}
                    onClick={() =>
                      deactivateMember.mutate(
                        { workspaceId, memberId: member._id },
                        {
                          onSuccess: () =>
                            queryClient.invalidateQueries({
                              queryKey: ["members", workspaceId],
                            }),
                        }
                      )
                    }
                  >
                    <UserX className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={removeMember.isPending}
                    onClick={() =>
                      removeMember.mutate(
                        { workspaceId, memberId: member._id },
                        {
                          onSuccess: () =>
                            queryClient.invalidateQueries({
                              queryKey: ["members", workspaceId],
                            }),
                        }
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AllMembers;
