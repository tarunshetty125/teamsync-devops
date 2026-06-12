import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import WorkspaceHeader from "@/components/workspace/common/workspace-header";
import EditWorkspaceForm from "@/components/workspace/edit-workspace-form";
import DeleteWorkspaceCard from "@/components/workspace/settings/delete-workspace-card";
import { Permissions, PermissionType } from "@/constant";
import { useAuthContext } from "@/context/auth-provider";
import withPermission from "@/hoc/with-permission";
import { toast } from "@/hooks/use-toast";
import useWorkspaceId from "@/hooks/use-workspace-id";
import { getApiAssetUrl } from "@/lib/base-url";
import {
  createExportMutationFn,
  createRoleMutationFn,
  deleteExportMutationFn,
  deleteRoleMutationFn,
  getAuditLogsQueryFn,
  getExportsQueryFn,
  getRolesQueryFn,
  getSecurityLoginsQueryFn,
  getSecuritySessionsQueryFn,
  getWorkspacePolicyQueryFn,
  revokeSecuritySessionMutationFn,
  updateRoleMutationFn,
  updateWorkspacePolicyMutationFn,
} from "@/lib/api";
import {
  ExportDatasetType,
  ExportFormatType,
  RoleType,
  WorkspacePolicyType,
} from "@/types/api.type";

const allPermissions = Object.values(Permissions) as PermissionType[];
const exportDatasets: ExportDatasetType[] = [
  "TASKS",
  "PROJECTS",
  "MEMBERS",
  "COMMENTS",
  "FILES",
  "TIME_ENTRIES",
  "AUDIT_LOGS",
];
const retentionValues = ["FOREVER", "90", "180", "365"] as const;

const formatDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";

const jsonSummary = (value?: Record<string, unknown>) =>
  value ? JSON.stringify(value).slice(0, 140) : "";

const SectionLoader = () => (
  <div className="flex min-h-32 items-center justify-center rounded-md border">
    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
  </div>
);

const AuditPanel = ({ workspaceId }: { workspaceId: string }) => {
  const { data, isLoading } = useQuery({
    queryKey: ["audit", workspaceId],
    queryFn: () => getAuditLogsQueryFn({ workspaceId, pageSize: 20 }),
  });

  if (isLoading) return <SectionLoader />;

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Audit logs</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data?.auditLogs.length ? (
          data.auditLogs.map((log) => (
            <div key={log._id} className="rounded-md border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{log.action}</Badge>
                <span className="text-sm font-medium">{log.entityType}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(log.createdAt)}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Entity {log.entityId} · IP {log.ipAddress}
              </p>
              {(log.before || log.after) && (
                <p className="mt-2 break-all text-xs text-muted-foreground">
                  {jsonSummary(log.after || log.before)}
                </p>
              )}
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No audit logs found.</p>
        )}
      </CardContent>
    </Card>
  );
};

const RolesPanel = ({ workspaceId }: { workspaceId: string }) => {
  const queryClient = useQueryClient();
  const [editingRole, setEditingRole] = useState<RoleType | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState<PermissionType[]>([
    Permissions.VIEW_ONLY,
  ]);
  const rolesQuery = useQuery({
    queryKey: ["roles", workspaceId],
    queryFn: () => getRolesQueryFn(workspaceId),
  });

  const resetForm = () => {
    setEditingRole(null);
    setName("");
    setDescription("");
    setPermissions([Permissions.VIEW_ONLY]);
  };

  const saveRole = useMutation({
    mutationFn: editingRole ? updateRoleMutationFn : createRoleMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["members", workspaceId] });
      resetForm();
      toast({ title: "Role saved", variant: "success" });
    },
    onError: (error) =>
      toast({ title: "Role save failed", description: error.message, variant: "destructive" }),
  });
  const deleteRole = useMutation({
    mutationFn: deleteRoleMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles", workspaceId] });
      toast({ title: "Role deleted", variant: "success" });
    },
  });

  const startEdit = (role: RoleType) => {
    if (role.isSystem) return;
    setEditingRole(role);
    setName(role.name);
    setDescription(role.description || "");
    setPermissions(role.permissions || [Permissions.VIEW_ONLY]);
  };

  const togglePermission = (permission: PermissionType) => {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">
            {editingRole ? "Edit custom role" : "Create custom role"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Role name" />
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
          />
          <div className="grid max-h-72 gap-2 overflow-auto rounded-md border p-3 md:grid-cols-2">
            {allPermissions.map((permission) => (
              <label key={permission} className="flex items-center gap-2 text-xs">
                <Checkbox
                  checked={permissions.includes(permission)}
                  onCheckedChange={() => togglePermission(permission)}
                />
                {permission}
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              disabled={!name || permissions.length === 0 || saveRole.isPending}
              onClick={() =>
                saveRole.mutate({
                  workspaceId,
                  roleId: editingRole?._id,
                  data: { name, description, permissions },
                })
              }
            >
              <Plus className="h-4 w-4" />
              Save Role
            </Button>
            {editingRole && (
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {rolesQuery.isLoading ? <SectionLoader /> : null}
          {rolesQuery.data?.roles.map((role) => (
            <div key={role._id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <button
                className="min-w-0 text-left"
                onClick={() => startEdit(role)}
                disabled={role.isSystem}
              >
                <div className="flex items-center gap-2">
                  <p className="font-medium">{role.name}</p>
                  {role.isSystem && <Badge variant="secondary">System</Badge>}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {(role.permissions || []).length} permissions
                </p>
              </button>
              {!role.isSystem && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteRole.mutate({ workspaceId, roleId: role._id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const PolicyPanel = ({ workspaceId }: { workspaceId: string }) => {
  const queryClient = useQueryClient();
  const policyQuery = useQuery({
    queryKey: ["policies", workspaceId],
    queryFn: () => getWorkspacePolicyQueryFn(workspaceId),
  });
  const [policy, setPolicy] = useState<WorkspacePolicyType | null>(null);

  useEffect(() => {
    if (policyQuery.data?.policy) setPolicy(policyQuery.data.policy);
  }, [policyQuery.data?.policy]);

  const savePolicy = useMutation({
    mutationFn: updateWorkspacePolicyMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies", workspaceId] });
      toast({ title: "Policy updated", variant: "success" });
    },
  });

  if (policyQuery.isLoading || !policy) return <SectionLoader />;

  const setRetention = (
    key: keyof WorkspacePolicyType["retention"],
    value: (typeof retentionValues)[number]
  ) => {
    setPolicy({
      ...policy,
      retention: {
        ...policy.retention,
        [key]: value === "FOREVER" ? null : Number(value),
      },
    });
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <CardTitle className="text-base">Workspace policies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={policy.comments.allowEdit}
              onCheckedChange={(checked) =>
                setPolicy({
                  ...policy,
                  comments: { ...policy.comments, allowEdit: Boolean(checked) },
                })
              }
            />
            Allow comment editing
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={policy.comments.allowDelete}
              onCheckedChange={(checked) =>
                setPolicy({
                  ...policy,
                  comments: { ...policy.comments, allowDelete: Boolean(checked) },
                })
              }
            />
            Allow comment deletion
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={policy.members.allowSelfInvite}
              onCheckedChange={(checked) =>
                setPolicy({
                  ...policy,
                  members: { ...policy.members, allowSelfInvite: Boolean(checked) },
                })
              }
            />
            Allow invite-code joins
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Max upload bytes</Label>
            <Input
              type="number"
              value={policy.files.maxUploadBytes}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  files: {
                    ...policy.files,
                    maxUploadBytes: Number(event.target.value),
                  },
                })
              }
            />
          </div>
          <div>
            <Label>Allowed MIME types</Label>
            <Input
              value={policy.files.allowedMimeTypes.join(",")}
              onChange={(event) =>
                setPolicy({
                  ...policy,
                  files: {
                    ...policy.files,
                    allowedMimeTypes: event.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.keys(policy.retention).map((key) => (
            <div key={key}>
              <Label>{key}</Label>
              <Select
                value={String(policy.retention[key as keyof typeof policy.retention] ?? "FOREVER")}
                onValueChange={(value) =>
                  setRetention(
                    key as keyof WorkspacePolicyType["retention"],
                    value as (typeof retentionValues)[number]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {retentionValues.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === "FOREVER" ? "Forever" : `${value} days`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <Button onClick={() => savePolicy.mutate({ workspaceId, data: policy })}>
          Save Policy
        </Button>
      </CardContent>
    </Card>
  );
};

const ExportsPanel = ({ workspaceId }: { workspaceId: string }) => {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<ExportFormatType>("JSON");
  const [datasets, setDatasets] = useState<ExportDatasetType[]>(["TASKS"]);
  const exportsQuery = useQuery({
    queryKey: ["exports", workspaceId],
    queryFn: () => getExportsQueryFn(workspaceId),
  });
  const createExport = useMutation({
    mutationFn: createExportMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exports", workspaceId] });
      toast({ title: "Export generated", variant: "success" });
    },
    onError: (error) =>
      toast({ title: "Export failed", description: error.message, variant: "destructive" }),
  });
  const deleteExport = useMutation({
    mutationFn: deleteExportMutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["exports", workspaceId] }),
  });

  const toggleDataset = (dataset: ExportDatasetType) => {
    setDatasets((current) =>
      current.includes(dataset)
        ? current.filter((item) => item !== dataset)
        : [...current, dataset]
    );
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Generate export</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Select value={format} onValueChange={(value) => setFormat(value as ExportFormatType)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["CSV", "JSON", "XLSX"] as ExportFormatType[]).map((item) => (
                <SelectItem key={item} value={item}>
                  {item}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid gap-2 md:grid-cols-3">
            {exportDatasets.map((dataset) => (
              <label key={dataset} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={datasets.includes(dataset)}
                  onCheckedChange={() => toggleDataset(dataset)}
                />
                {dataset}
              </label>
            ))}
          </div>
          <Button
            disabled={datasets.length === 0 || createExport.isPending}
            onClick={() => createExport.mutate({ workspaceId, data: { format, datasets } })}
          >
            <RefreshCw className="h-4 w-4" />
            Generate
          </Button>
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Recent exports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {exportsQuery.data?.exportJobs.map((job) => (
            <div key={job._id} className="flex items-center justify-between gap-3 rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">
                  {job.format} · {job.datasets.join(", ")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {job.status} · expires {formatDate(job.expiresAt)}
                </p>
              </div>
              <div className="flex gap-2">
                {job.downloadPath && (
                  <Button variant="outline" size="icon" asChild>
                    <a href={getApiAssetUrl(job.downloadPath)}>
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteExport.mutate({ workspaceId, exportId: job._id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const SecurityPanel = ({ workspaceId }: { workspaceId: string }) => {
  const queryClient = useQueryClient();
  const sessionsQuery = useQuery({
    queryKey: ["security", workspaceId, "sessions"],
    queryFn: () => getSecuritySessionsQueryFn(workspaceId),
  });
  const loginsQuery = useQuery({
    queryKey: ["security", workspaceId, "logins"],
    queryFn: () => getSecurityLoginsQueryFn(workspaceId),
  });
  const revokeSession = useMutation({
    mutationFn: revokeSecuritySessionMutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["security", workspaceId] });
      toast({ title: "Session revoked", variant: "success" });
    },
  });

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Active sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sessionsQuery.data?.sessions.map((session) => (
            <div key={session.sessionId} className="rounded-md border p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{session.ipAddress}</p>
                  <p className="max-w-sm truncate text-xs text-muted-foreground">
                    {session.userAgent}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last active {formatDate(session.lastActiveAt)}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    revokeSession.mutate({
                      workspaceId,
                      sessionId: session.sessionId,
                    })
                  }
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Recent logins</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loginsQuery.data?.logins.map((login) => (
            <div key={login._id} className="rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{login.provider}</p>
                <Badge variant={login.success ? "secondary" : "destructive"}>
                  {login.success ? "Success" : "Failed"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {login.ipAddress} · {formatDate(login.createdAt)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const Settings = () => {
  const workspaceId = useWorkspaceId();
  const { hasPermission } = useAuthContext();
  const canAudit = hasPermission(Permissions.VIEW_AUDIT_LOG);
  const canManageRoles = hasPermission(Permissions.MANAGE_ROLES);
  const canManagePolicies = hasPermission(Permissions.MANAGE_POLICIES);
  const canExport = hasPermission(Permissions.EXPORT_DATA);

  const defaultTab = useMemo(() => {
    if (canAudit) return "audit";
    return "general";
  }, [canAudit]);

  return (
    <div className="w-full h-auto py-2">
      <WorkspaceHeader />
      <Separator className="my-4" />
      <main>
        <div className="w-full max-w-6xl mx-auto py-3">
          <h2 className="text-[20px] leading-[30px] font-semibold mb-3">
            Workspace settings
          </h2>
          <Tabs defaultValue={defaultTab} className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="general">General</TabsTrigger>
              {canAudit && <TabsTrigger value="audit">Audit Logs</TabsTrigger>}
              {canManageRoles && <TabsTrigger value="roles">Roles</TabsTrigger>}
              {canManagePolicies && (
                <TabsTrigger value="policies">Policies</TabsTrigger>
              )}
              {canExport && <TabsTrigger value="exports">Exports</TabsTrigger>}
              {canAudit && <TabsTrigger value="security">Security</TabsTrigger>}
            </TabsList>
            <TabsContent value="general">
              <div className="max-w-3xl space-y-4">
                <EditWorkspaceForm />
                <DeleteWorkspaceCard />
              </div>
            </TabsContent>
            {canAudit && (
              <TabsContent value="audit">
                <AuditPanel workspaceId={workspaceId} />
              </TabsContent>
            )}
            {canManageRoles && (
              <TabsContent value="roles">
                <RolesPanel workspaceId={workspaceId} />
              </TabsContent>
            )}
            {canManagePolicies && (
              <TabsContent value="policies">
                <PolicyPanel workspaceId={workspaceId} />
              </TabsContent>
            )}
            {canExport && (
              <TabsContent value="exports">
                <ExportsPanel workspaceId={workspaceId} />
              </TabsContent>
            )}
            {canAudit && (
              <TabsContent value="security">
                <SecurityPanel workspaceId={workspaceId} />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </main>
    </div>
  );
};

const SettingsWithPermission = withPermission(
  Settings,
  Permissions.MANAGE_WORKSPACE_SETTINGS
);

export default SettingsWithPermission;
