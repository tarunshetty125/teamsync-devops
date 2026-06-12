import {
  AuditActionEnum,
  DomainEntityTypeEnum,
} from "../enums/domain.enum";
import WorkspacePolicyModel, {
  defaultWorkspacePolicy,
  WorkspacePolicyDocument,
} from "../models/workspace-policy.model";
import { RequestContext } from "../types/request-context";
import { recordAuditLog } from "./audit-log.service";
import { assertOwner } from "./governance-access.service";

type PolicyPatch = Partial<{
  comments: WorkspacePolicyDocument["comments"];
  files: WorkspacePolicyDocument["files"];
  members: WorkspacePolicyDocument["members"];
  retention: WorkspacePolicyDocument["retention"];
}>;

const serializePolicy = (policy: WorkspacePolicyDocument) => ({
  _id: policy._id.toString(),
  workspace: policy.workspace.toString(),
  comments: policy.comments,
  files: policy.files,
  members: policy.members,
  retention: policy.retention,
  updatedBy: policy.updatedBy?.toString() ?? null,
  createdAt: policy.createdAt,
  updatedAt: policy.updatedAt,
});

export const getOrCreateWorkspacePolicy = async (workspaceId: string) => {
  const policy = await WorkspacePolicyModel.findOneAndUpdate(
    { workspace: workspaceId },
    { $setOnInsert: { workspace: workspaceId, ...defaultWorkspacePolicy } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return policy;
};

export const getWorkspacePolicyService = async (
  workspaceId: string,
  userId: string
) => {
  await assertOwner(workspaceId, userId);
  const policy = await getOrCreateWorkspacePolicy(workspaceId);

  return { policy: serializePolicy(policy) };
};

export const updateWorkspacePolicyService = async (
  context: RequestContext,
  patch: PolicyPatch
) => {
  await assertOwner(context.workspaceId, context.userId);

  const existing = await getOrCreateWorkspacePolicy(context.workspaceId);
  const before = serializePolicy(existing);

  const update = {
    comments: { ...existing.comments, ...patch.comments },
    files: { ...existing.files, ...patch.files },
    members: { ...existing.members, ...patch.members },
    retention: { ...existing.retention, ...patch.retention },
    updatedBy: context.userId,
  };

  const policy = await WorkspacePolicyModel.findOneAndUpdate(
    { workspace: context.workspaceId },
    { $set: update },
    { new: true, runValidators: true }
  );

  await recordAuditLog(context, {
    action: AuditActionEnum.UPDATED,
    entityType: DomainEntityTypeEnum.WORKSPACE_POLICY,
    entityId: policy!._id.toString(),
    before,
    after: serializePolicy(policy!),
  });

  return { policy: serializePolicy(policy!) };
};
