import { Project, QueryOptions } from '#shared/entities.js';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { OrgScopedDao } from './dao-org-scoped.js';


export const PROJECT_COLUMNS = Object.freeze(['id', 'cid', 'ctime', 'mid', 'mtime', 'name', "wksId"] as const);

export class ProjectDao extends OrgScopedDao<Project, number, QueryOptions<Project>> {
	constructor() { super({ table: 'project', stamped: true }) }
	
	//#region    ---------- BaseDao Overrides ---------- 
	@AccessRequires('a_admin', 'org_a_project_manage')
	async get(utx: UserContext, id: number) {
		return super.get(utx, id);
	}

	@AccessRequires('a_admin', 'org_a_project_manage')
	@Monitor()
	async list(utx: UserContext, queryOptions?: QueryOptions<Project>): Promise<Project[]> {
		return super.list(utx, queryOptions);
	}

	@AccessRequires('#user') // any user can create a new project within a workspace they have access to
	@Monitor()
	async create(utx: UserContext, data: Partial<Project>) {
		const wksId = await super.create(utx, data);
		return wksId;
	}

	@AccessRequires('a_admin', 'org_a_project_manage')
	async update(utx: UserContext, id: number, data: Partial<Project>) {
		return super.update(utx, id, data);
	}

	@AccessRequires('a_admin', 'org_a_project_manage')
	async remove(utx: UserContext, ids: number | number[]) {
		return super.remove(utx, ids);
	}
	//#endregion ---------- /BaseDao Overrides ---------- 
}
