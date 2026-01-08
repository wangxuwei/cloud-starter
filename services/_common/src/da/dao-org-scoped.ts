import { OrgScopedEntity, QueryOptions } from '#shared/entities.js';
import { Err } from '../error.js';
import { UserContext } from '../user-context.js';
import { symbolDic } from '../utils.js';
import { AccessRequires } from './access.js';
import { BaseDao, CustomQuery } from './dao-base.js';

const ERROR = symbolDic(
	'NO_ORGID_IN_UTX',
	'NO_MATCHING_ORGID_UTX_DATA'
)

export class OrgScopedDao<E extends OrgScopedEntity, I, Q extends QueryOptions<E> = QueryOptions<E>> extends BaseDao<E, I, Q>  {

	@AccessRequires('org_a_content_view')
	async get(utx: UserContext, id: I): Promise<E> {
		this.scopeData(utx);
		return super.get(utx, id);
	}

	@AccessRequires('org_a_content_create')
	async create(utx: UserContext, data: Partial<E>): Promise<I> {
		this.scopeData(utx, data);
		return super.create(utx, data)
	}

	@AccessRequires('org_a_content_edit', "@cid")
	async update(utx: UserContext, id: I, data: Partial<E>) {
		this.scopeData(utx, data);
		return super.update(utx, id, data);
	}

	@AccessRequires('org_a_content_edit', "@cid")
	async list(utx: UserContext, queryOptions?: Q & CustomQuery): Promise<E[]> {
		this.scopeQuery(utx, queryOptions);
		return super.list(utx, queryOptions);
	}

	@AccessRequires('org_a_content_edit', "@cid")
	async remove(utx: UserContext, id: I | I[]): Promise<number> {
		return super.remove(utx, id);
	}

	//#region    ---------- ORG Scoped Helper Methods ---------- 
	scopeQuery(utx: UserContext, queryOptions?: Q & CustomQuery) {
		const orgId = utx.orgId;
		if (orgId == null) {
			throw new Err(ERROR.NO_ORGID_IN_UTX, `${this.constructor.name}.list`);
		}
		// TS NOTE: Here, cannot use Q, TS can't infer correctly.
		const orgScopedQueryOptions: QueryOptions<E> & CustomQuery = queryOptions ?? {};
		orgScopedQueryOptions.matching = orgScopedQueryOptions.matching ?? {};
		orgScopedQueryOptions.matching.orgId = orgId;
	}

	scopeData(utx: UserContext, data?: Partial<OrgScopedEntity>) {
		const orgId = utx.orgId;
		if (orgId == null) {
			throw new Err(ERROR.NO_ORGID_IN_UTX, `${this.constructor.name}.scopeData`);
		}

		// If we have a data id make sure the orgId match, and if not present in data, set it
		if (data != null) {
			if (data.orgId != null && data.orgId !== orgId) {
				throw new Err(ERROR.NO_MATCHING_ORGID_UTX_DATA, `${this.constructor.name}.scopeData UTX.orgId ${orgId} does not match data.orgId ${data.orgId}`);
			}
			// set the org
			data.orgId = orgId;
		}
	}
	//#endregion ---------- /ORG Scoped Helper Methods ---------- 

}
