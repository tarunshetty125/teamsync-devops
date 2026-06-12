import {
  Roles,
  Permissions,
  PermissionType,
  RoleType,
} from "../enums/role.enum";

export const RolePermissions: Record<RoleType, Array<PermissionType>> = {
  OWNER: [
    Permissions.CREATE_WORKSPACE,
    Permissions.EDIT_WORKSPACE,
    Permissions.DELETE_WORKSPACE,
    Permissions.MANAGE_WORKSPACE_SETTINGS,

    Permissions.ADD_MEMBER,
    Permissions.CHANGE_MEMBER_ROLE,
    Permissions.REMOVE_MEMBER,

    Permissions.CREATE_PROJECT,
    Permissions.EDIT_PROJECT,
    Permissions.DELETE_PROJECT,

    Permissions.CREATE_TASK,
    Permissions.EDIT_TASK,
    Permissions.DELETE_TASK,
    Permissions.MANAGE_TASK_RELATIONS,

    Permissions.CREATE_COMMENT,
    Permissions.EDIT_COMMENT,
    Permissions.DELETE_COMMENT,

    Permissions.UPLOAD_FILE,
    Permissions.DELETE_FILE,

    Permissions.MANAGE_NOTIFICATION_SETTINGS,
    Permissions.EDIT_PROFILE,

    Permissions.TRACK_TIME,
    Permissions.VIEW_TIMESHEETS,
    Permissions.MANAGE_TIME_ENTRIES,
    Permissions.MANAGE_CAPACITY,

    Permissions.EXPORT_DATA,
    Permissions.VIEW_AUDIT_LOG,
    Permissions.MANAGE_ROLES,
    Permissions.MANAGE_POLICIES,

    Permissions.VIEW_ONLY,
  ],
  ADMIN: [
    Permissions.ADD_MEMBER,
    Permissions.REMOVE_MEMBER,
    Permissions.CREATE_PROJECT,
    Permissions.EDIT_PROJECT,
    Permissions.DELETE_PROJECT,
    Permissions.CREATE_TASK,
    Permissions.EDIT_TASK,
    Permissions.DELETE_TASK,
    Permissions.MANAGE_TASK_RELATIONS,
    Permissions.CREATE_COMMENT,
    Permissions.EDIT_COMMENT,
    Permissions.DELETE_COMMENT,
    Permissions.UPLOAD_FILE,
    Permissions.DELETE_FILE,
    Permissions.MANAGE_NOTIFICATION_SETTINGS,
    Permissions.EDIT_PROFILE,
    Permissions.TRACK_TIME,
    Permissions.VIEW_TIMESHEETS,
    Permissions.MANAGE_TIME_ENTRIES,
    Permissions.MANAGE_CAPACITY,
    Permissions.EXPORT_DATA,
    Permissions.VIEW_AUDIT_LOG,
    Permissions.MANAGE_WORKSPACE_SETTINGS,
    Permissions.VIEW_ONLY,
  ],
  MEMBER: [
    Permissions.VIEW_ONLY,
    Permissions.CREATE_TASK,
    Permissions.EDIT_TASK,
    Permissions.CREATE_COMMENT,
    Permissions.EDIT_COMMENT,
    Permissions.DELETE_COMMENT,
    Permissions.UPLOAD_FILE,
    Permissions.DELETE_FILE,
    Permissions.MANAGE_NOTIFICATION_SETTINGS,
    Permissions.EDIT_PROFILE,
    Permissions.TRACK_TIME,
  ],
};
