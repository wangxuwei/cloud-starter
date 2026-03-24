const { freeze } = Object;

export const globalRoleEnum = freeze({
  r_sys: 'r_sys',
  r_user: 'r_user',
  r_admin: 'r_admin'
} as const);

export type GlobalRole = keyof typeof globalRoleEnum;

export const globalAccessEnum = freeze({
  '#sys': '#sys',
  '#user': '#user',
  'a_ui': 'a_ui',
  'a_api': 'a_api',
  'a_admin': 'a_admin',
  'a_pwd_reset': 'a_pwd_reset',
  'a_admin_edit_user': 'a_admin_edit_user',
} as const);

export type GlobalAccess = keyof typeof globalAccessEnum;

// Note: We use array to {[key]: true} object so that it can be frozen (Set cannot be be frozen without wrapper)

const R_USER_ACCESSES: GlobalAccess[] = ['#user', 'a_ui'];
export const globalAccessesForRoleUser = freeze(R_USER_ACCESSES.reduce((obj, v) => (obj[v] = true, obj), {} as any));

const R_SYS_ACCESSES: GlobalAccess[] = ['#sys'];
export const globalAccessesForRoleSys = freeze(R_SYS_ACCESSES.reduce((obj, v) => (obj[v] = true, obj), {} as any));

const R_ADMIN_ACCESSES: GlobalAccess[] = [...R_USER_ACCESSES, 'a_admin', 'a_admin_edit_user', 'a_pwd_reset'];
export const globalAccessesForRoleAdmin = freeze(R_ADMIN_ACCESSES.reduce((obj, v) => (obj[v] = true, obj), {} as any));

type AccessesByRole = { [key in GlobalRole]: { [key in GlobalAccess]: true } };
export const accessesByRole: AccessesByRole = freeze({
  'r_sys': globalAccessesForRoleSys,
  'r_user': globalAccessesForRoleUser,
  'r_admin': globalAccessesForRoleAdmin
});

