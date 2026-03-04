import { QueryOptions, Wks } from '#shared/entities.js';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { OrgScopedDao } from './dao-org-scoped.js';


export class WksDao extends OrgScopedDao<Wks, number, QueryOptions<Wks>> {
	constructor() { super({ table: 'wks', stamped: true }) }
	
	//#region    ---------- BaseDao Overrides ---------- 
	@AccessRequires('a_admin', 'org_a_wks_manage')
	async get(utx: UserContext, id: number) {
		return super.get(utx, id);
	}

	@AccessRequires('a_admin', 'org_a_wks_manage')
	@Monitor()
	async list(utx: UserContext, queryOptions?: QueryOptions<Wks>): Promise<Wks[]> {
		return super.list(utx, queryOptions);
	}

	@AccessRequires('#user') // any user can create a new wks, it will be to org_r_owner
	@Monitor()
	async create(utx: UserContext, data: Partial<Wks>) {
		const wksId = await super.create(utx, data);
		return wksId;
	}

	@AccessRequires('a_admin', 'org_a_wks_manage')
	async update(utx: UserContext, id: number, data: Partial<Wks>) {
		return super.update(utx, id, data);
	}

	@AccessRequires('a_admin', 'org_a_wks_manage')
	async remove(utx: UserContext, ids: number | number[]) {
		return super.remove(utx, ids);
	}
	//#endregion ---------- /BaseDao Overrides ---------- 
}
