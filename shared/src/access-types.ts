const { freeze, entries } = Object; // for readibility


//#region    ---------- App Access ---------- 
const GLOBAL_ACCESSES = freeze([
	'#sys', // this is a special access only for getSysContext
	'#user', // any logged request (api or user) get the special #user access
	'a_ui', // ui web interface access (web login). Can be negated in user.accesses modifiers
	'a_api', // for API access. Can bee added in user.accesses modifiers
	'a_admin', // all basic admin tasks
	'a_pwd_reset', // password reset
	'a_admin_edit_user' // ability to reset user information
] as const);

export type GlobalAccess = typeof GLOBAL_ACCESSES[number];

export type GlobalAccesses = { [key in GlobalAccess]?: true };

// Note: Widen type to string to allow caller to call .has(name:string) 
const GLOBAL_ACCESSES_SET = freeze(new Set(GLOBAL_ACCESSES as readonly string[]));

export function isAccess(name: string): name is GlobalAccess {
	return GLOBAL_ACCESSES_SET.has(name);
}

// By default r_user have the web ui access.
// Also all users have the special '#user' access (any user)
const r_user: Readonly<GlobalAccess[]> = freeze(['#user', 'a_ui']);
const r_admin: Readonly<GlobalAccess[]> = freeze([...r_user, 'a_admin', 'a_admin_edit_user', 'a_pwd_reset']);

const _GLOBAL_ROLES = freeze({
	r_user,
	r_admin
} as const);


export type GlobalRoleName = keyof typeof _GLOBAL_ROLES;


// Note: widen tyime to allow .get(string)
export const GLOBAL_ROLES = freeze(new Map(entries(_GLOBAL_ROLES)));

//#endregion ---------- /App Access ---------- 

//#region    ---------- Org Access ---------- 
// `org_a_` prefix for Org Privilege
// The list of all Org privilege Should be 
const ORG_ACCESSES = freeze([
	'org_a_delete',
	'org_a_user_assign_admin', // add user admin (only owner)
	'org_a_content_create', // Create new content for this org
	'org_a_content_edit', // 
	'org_a_content_view', // view info and tickets from a Orgs
	'org_a_user_add', // add user
	'org_a_user_remove'
] as const);

// OrgPrivilege type "pp_user_add_admin" | "pp_edit" | ....
export type OrgAccess = typeof ORG_ACCESSES[number];

export type OrgAccesses = { [key in OrgAccess]?: true };

// Note: Widen type to string to allow caller to call .has(name:string) 
const ORG_ACCESSES_SET = freeze(new Set(ORG_ACCESSES as readonly string[]));

export function isOrgAccess(name: any): name is OrgAccess {
	return ORG_ACCESSES_SET.has(name);
}
export function assertOrgAccess(name: any): asserts name is OrgAccess {
	if (!isOrgAccess(name)) {
		throw new Error(`Access ${name} is not a valid workspace access. Must be one of ${ORG_ACCESSES}`);
	}
}


// `org_r_` prefix for Org Role
const org_r_viewer: Readonly<OrgAccess[]> = freeze(['org_a_content_view']);
const org_r_editor: Readonly<OrgAccess[]> = freeze([...org_r_viewer, 'org_a_content_create', 'org_a_content_edit']);
const org_r_admin: Readonly<OrgAccess[]> = freeze([...org_r_editor, 'org_a_user_remove', 'org_a_user_add']);
const org_r_owner: Readonly<OrgAccess[]> = ORG_ACCESSES;


// Org Roles to be export with the correct typing (this will post mistak above)
const _ORG_ROLES = freeze({
	org_r_owner:  org_r_owner,
	org_r_admin:  org_r_admin,
	org_r_editor: org_r_editor,
	org_r_viewer: org_r_viewer
} as const);

export type OrgRoleName = keyof typeof _ORG_ROLES;


// Note: Readonly Map<string, OrgPrivilegeName> Wider map (Map<string, readonly OrgPivilegeName[]>) allowing caller to call .has(name:string)
export const ORG_ROLES = freeze(new Map(entries(_ORG_ROLES)));

// Note: To help OrgRolesName entry key typing (otherwise string)
const orgRolesEntries = entries(_ORG_ROLES) as [OrgRoleName, Readonly<OrgAccess[]>][];

export const ORG_ROLES_BY_ACCESS = freeze(orgRolesEntries
	.reduce((acc, [role, accesses]) => {
		for (const access of accesses) {
			const roles = acc.get(access)?.concat(role) ?? [role];
			acc.set(access, freeze(roles));
		}
		return acc;
	}, new Map<OrgAccess, Readonly<OrgRoleName[]>>()));
//#endregion ---------- /Org Access ----------



