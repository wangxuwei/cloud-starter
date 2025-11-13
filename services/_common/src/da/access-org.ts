
import { OrgRoleName, ORG_ROLES } from '#shared/access-types.js';
import { getKnexClient } from './db.js';



export async function saveOrgRole(userId: number, orgId: number, role: OrgRoleName) {
	const k = await getKnexClient();
	// insert into user_org ("userId", "orgId", role) values (1, 1032, 'owner') on conflict on CONSTRAINT user_org_pkey do update set name = 'owner'
	const sql = `insert into user_org ("userId", "orgId", role) values (?, ?, ?) 
	on conflict on CONSTRAINT user_org_pkey do update set role = ?`;
	const values = [userId, orgId, role, role];
	const r = await k.raw(sql, values);
	return r; // TODO: could return 'updated' or 'inserted' if needed / possible.
}


// NOTE: here we do not use the daos scheme to get the role as it will add cyclic issues and it is not needed. 
export async function getOrgAccesses(userId: number, orgId: number) {
	const k = await getKnexClient();
	let query = k('user_org');

	query.where({ userId, orgId });

	// do the query (need cast here)
	const records = await query.then() as any[];

	const roles = records.map(r => r.role as string);

	const accessList = [];
	for (const role of roles) {
		const privs = ORG_ROLES.get(role);
		if (privs) {
			accessList.push(...privs);
		} else {
			// TODO: log CODE_ERROR
		}
	}

	return accessList;

}