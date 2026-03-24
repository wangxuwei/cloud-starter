const { freeze } = Object;

export const orgRoleEnum = freeze({
  org_r_owner: 'org_r_owner',
  org_r_admin: 'org_r_admin',
  org_r_editor: 'org_r_editor',
  org_r_viewer: 'org_r_viewer',
} as const);

export type OrgRole = keyof typeof orgRoleEnum;

export const orgAccessEnum = freeze({
  org_a_delete: 'org_a_delete',
  org_a_user_assign_admin: 'org_a_user_assign_admin',
  org_a_content_create: 'org_a_content_create',
  org_a_content_edit: 'org_a_content_edit',
  org_a_content_view: 'org_a_content_view',
  org_a_wks_manage: 'org_a_wks_manage',
  org_a_project_manage: 'org_a_project_manage',
  org_a_user_add: 'org_a_user_add',
  org_a_user_remove: 'org_a_user_remove',
} as const);

export type OrgAccess = keyof typeof orgAccessEnum;

