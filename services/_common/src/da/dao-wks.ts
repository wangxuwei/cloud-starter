import { QueryOptions, RelationshipConfig, Wks } from '#shared/entities.js';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { OrgScopedDao } from './dao-org-scoped.js';
import { PROJECT_COLUMNS } from './dao-project.js';
import { projectDao } from './daos.js';
import { IncludeProcessorOptions } from './include-utils.js';


export const WKS_COLUMNS = Object.freeze(['id', 'cid', 'ctime', 'mid', 'mtime', 'name'] as const);

export class WksDao extends OrgScopedDao<Wks, number, QueryOptions<Wks>> {
	constructor() { super({ table: 'wks', stamped: true, allColumns: [...WKS_COLUMNS] }) }
	
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


	//#region    ---------- Include Processor Options ---------- 
	protected getIncludeProcessorOptions(): IncludeProcessorOptions {
		const baseOptions = super.getIncludeProcessorOptions();
		return {
			...baseOptions,
			columnGroups: {
				...baseOptions.columnGroups,
				_details: ['id', 'name']
			},
			relationships: {
				project: {
					type: 'hasMany',
					targetTable: 'project',
					foreignKey: 'wksId',
					targetKey: 'id',
					as: 'p',
					targetColumns: ['id', 'name'],
					targetAllColumns: [...PROJECT_COLUMNS],
					targetColumnGroups: {
						_defaults: ['id', 'name']
					},
					targetStamped: true,
					includes: {} // Empty object means use default columns from targetColumns
				} as RelationshipConfig
			}
		};
	}

	protected getRelatedDao(relation: string) {
		if (relation === 'project') {
			return projectDao;
		}
		return null;
	}
	//#endregion ---------- /Include Processor Options ---------- 
}
