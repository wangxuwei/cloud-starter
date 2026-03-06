import { assertOrgAccess, ORG_ROLES, ORG_ROLES_BY_ACCESS, OrgAccess } from '#shared/access-types.js';
import { Org, QueryOptions, User } from '#shared/entities.js';
import { Err } from '../error.js';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { symbolDic } from '../utils.js';
import { saveOrgRole } from './access-org.js';
import { AccessRequires } from './access.js';
import { BaseDao } from './dao-base.js';
import { knexQuery } from './db.js';


const ERROR = symbolDic(
	'LIST_FAIL_NO_ORG_ROLE'
);

export const ORG_COLUMNS = Object.freeze(['id', 'cid', 'ctime', 'mid', 'mtime', 'name'] as const);

/** OrgQueryOptions MUST defined that required OrgAccess for the query */
export interface OrgQueryOptions extends QueryOptions<Org> {
	access: OrgAccess
}

export class OrgDao extends BaseDao<Org, number, OrgQueryOptions> {
	constructor() { super({ table: 'org', stamped: true }) }

	//#region    ---------- Entity Processing ---------- 
	protected parseRecord(obj: any): Org {
		const entity = super.parseRecord(obj) as any;

		// If .wrole create the OrgAccesses object from the role
		if (entity.wrole) {
			const accessList = ORG_ROLES.get(entity.wrole) as Readonly<OrgAccess[]>;
			entity.accesses = Object.freeze(accessList?.reduce(
				(acc, val) => { acc[val] = true; return acc },
				{} as { [key in OrgAccess]?: true }));

			// remove the wrole, nobody should use it after this.
			delete entity['wrole'];
		}

		return entity as Org;
	}
	//#endregion ---------- /Entity Processing ---------- 


	@AccessRequires('a_admin', 'org_a_user_assign_admin')
	async getOwners(utx: UserContext, orgId: number): Promise<User[]> {
		const { query } = await knexQuery({ utx, tableName: 'user' });

		// select "user".* from "user" right join user_org on "user".id = user_org."userId"
		//    where "orgId" = 1000 and user_org.name = 'owner';
		const r: any[] = await query.column('user.*').rightJoin('user_org', 'user.id', 'user_org.userId')
			.where({ orgId, 'user_org.name': 'owner' });

		// TODO: need to make it generic to dao (to cleanup data from db)
		r.forEach(user => { delete user.pwd });
		return r;
	}

	//#region    ---------- BaseDao Overrides ---------- 
	@AccessRequires('a_admin', 'org_a_content_view')
	async get(utx: UserContext, id: number) {
		return super.get(utx, id);
	}

	@AccessRequires('a_admin', 'org_a_content_view')
	@Monitor()
	async list(utx: UserContext, queryOptions?: OrgQueryOptions): Promise<Org[]> {
		const queryAccess = queryOptions?.access;

		//// if #sys or a_admin global access, query all
		if (utx.hasAccess('#sys') || utx.hasAccess('a_admin')) {
			return super.list(utx, queryOptions);
		}
		//// otherwise, if queryAccess, has to be org scoped
		else if (queryAccess === 'org_a_content_view') { // check that it matches the @AccessRequires of the method

			// make sure valid access
			assertOrgAccess(queryAccess);

			// get org roles for this access
			// Note: for now, just store org roles in deb, so, we have to reverse access to roles to make appropriate query
			const roles = ORG_ROLES_BY_ACCESS.get(queryAccess)!; // safe as we know org_a_content_view has roles

			const { query } = await knexQuery({ utx, tableName: this.table });
			query.columns(ORG_COLUMNS.map(n => `org.${n}`));
			query.column('user_org.role as role');
			this.completeQueryBuilder(utx, query, queryOptions);
			query.join('user_org', 'org.id', 'user_org.orgId');
			// NOTE: These both where and whereIn, will be correctly AND
			query.where({
				'user_org.userId': utx.userId,
			});
			query.whereIn('user_org.role', roles);
			const records = await query;

			return this.parseRecords(records);
		}
		//// otheriwise, throw error
		else {
			throw new Err(ERROR.LIST_FAIL_NO_ORG_ROLE, `Cannot do productDao.list for user ${utx.userId} - No org role found for access ${queryAccess}`);
		}

	}

	@AccessRequires('#user') // any user can create a new org, it will be the org_r_owner
	@Monitor()
	async create(utx: UserContext, data: Partial<Org>) {
		const orgId = await super.create(utx, data);

		await saveOrgRole(utx.userId, orgId, 'org_r_owner');
		return orgId;
	}

	@AccessRequires('a_admin', 'org_a_content_edit')
	async update(utx: UserContext, id: number, data: Partial<Org>) {
		return super.update(utx, id, data);
	}

	@AccessRequires('a_admin', 'org_a_delete')
	async remove(utx: UserContext, ids: number | number[]) {
		return super.remove(utx, ids);
	}
	//#endregion ---------- /BaseDao Overrides ---------- 
}
