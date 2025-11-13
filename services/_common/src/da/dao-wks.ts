import { OrgAccess } from '#shared/access-types.js';
import { QueryOptions, Wks } from '#shared/entities.js';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { BaseDao } from './dao-base.js';


export const WKS_COLUMNS = Object.freeze(['id', 'cid', 'ctime', 'mid', 'mtime', 'name'] as const);

/** WksQueryOptions MUST defined the required OrgAccess for the query */
export interface WksQueryOptions extends QueryOptions<Wks> {
	access: OrgAccess
}

export class WksDao extends BaseDao<Wks, number, WksQueryOptions> {
	constructor() { super({ table: 'wks', stamped: true }) }
	
	//#region    ---------- BaseDao Overrides ---------- 
	@AccessRequires('a_admin', 'org_a_content_view')
	async get(utx: UserContext, id: number) {
		return super.get(utx, id);
	}

	@AccessRequires('a_admin', 'org_a_content_view')
	@Monitor()
	async list(utx: UserContext, queryOptions?: WksQueryOptions): Promise<Wks[]> {
		return super.list(utx, queryOptions);
	}

	@AccessRequires('#user') // any user can create a new wks, it will be the org_r_owner
	@Monitor()
	async create(utx: UserContext, data: Partial<Wks>) {
		const wksId = await super.create(utx, data);
		return wksId;
	}

	@AccessRequires('a_admin', 'org_a_content_edit')
	async update(utx: UserContext, id: number, data: Partial<Wks>) {
		return super.update(utx, id, data);
	}

	@AccessRequires('a_admin', 'org_a_delete')
	async remove(utx: UserContext, ids: number | number[]) {
		return super.remove(utx, ids);
	}
	//#endregion ---------- /BaseDao Overrides ---------- 
}