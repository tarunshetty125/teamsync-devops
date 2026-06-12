import mongoose, { Schema, Document } from "mongoose";
import {
  Permissions,
  PermissionType,
  Roles,
} from "../enums/role.enum";
import { RolePermissions } from "../utils/role-permission";

export interface RoleDocument extends Document {
  workspace?: mongoose.Types.ObjectId | null;
  name: string;
  description?: string | null;
  permissions: Array<PermissionType>;
  isSystem: boolean;
  createdBy?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;
  deletedBy?: mongoose.Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<RoleDocument>(
  {
    workspace: {
      type: Schema.Types.ObjectId,
      ref: "Workspace",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: null,
    },
    permissions: {
      type: [String],
      enum: Object.values(Permissions),
      required: true,
      default: function (this: RoleDocument) {
        const roleName = this?.name as keyof typeof RolePermissions | undefined;
        return roleName ? RolePermissions[roleName] || [] : [];
      },
    },
    isSystem: {
      type: Boolean,
      required: true,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

roleSchema.pre("validate", function (next) {
  if (Object.values(Roles).includes(this.name as keyof typeof Roles)) {
    this.isSystem = true;
    this.workspace = null;
    this.permissions =
      RolePermissions[this.name as keyof typeof RolePermissions] || this.permissions;
  }

  next();
});

roleSchema.index(
  { name: 1 },
  {
    unique: true,
    partialFilterExpression: { isSystem: true },
  }
);
roleSchema.index(
  { workspace: 1, name: 1 },
  {
    unique: true,
    partialFilterExpression: { isSystem: false, deletedAt: null },
  }
);
roleSchema.index({ workspace: 1, deletedAt: 1, createdAt: -1 });

const RoleModel = mongoose.model<RoleDocument>("Role", roleSchema);
export default RoleModel;
