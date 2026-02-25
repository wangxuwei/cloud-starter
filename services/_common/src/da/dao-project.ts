import { Project, QueryOptions } from '#shared/entities.js';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { OrgScopedDao } from './dao-org-scoped.js';
import { RelationshipConfig } from './include-utils.js';
import { wksDao } from './daos.js';


export const PROJECT_COLUMNS = Object.freeze(['id', 'cid', 'ctime', 'mid', 'mtime', 'name', "wksId"] as const);

export class ProjectDao extends OrgScopedDao<Project, number> {
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

	@AccessRequires('#user') // any user can create a new project, it will be the org_r_owner
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

	//#region    ---------- Include Processor Options ---------- 
	protected getIncludeProcessorOptions() {
		const baseOptions = super.getIncludeProcessorOptions();
		return {
			...baseOptions,
			columnGroups: {
				...baseOptions.columnGroups,
				_projectInfo: ['id', 'name', 'wksId'],
				_details: ['id', 'name', 'description']
			},
			relationships: {
				workspace: {
					type: 'belongsTo',
					targetTable: 'workspace',
					foreignKey: 'wksId',
					targetKey: 'id',
					as: 'workspace',
					targetColumns: ['id', 'name'],
					targetColumnGroups: {
						_defaults: ['id', 'name']
					},
					targetStamped: true
				} as RelationshipConfig
			}
		};
	}

	protected getRelatedDao(relation: string) {
		if (relation === 'workspace') {
			return wksDao;
		}
		return null;
	}
	//#endregion ---------- /Include Processor Options ---------- 
}
