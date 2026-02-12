// <origin src="services/web-server/src/web/rpc-org.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

import { OrgQueryOptions } from '#common/da/dao-org.js';
import { orgDao } from '#common/da/daos.js';
import { ApiKtx } from '#common/web/koa-utils.js';
import { RpcMethod } from '#common/web/rpc.js';
import { createEntity, deleteEntity, getEntity, updateEntity } from './rpc-generics.js';

// region:    --- Org RPC Methods ---

class RpcHandlers{

	@RpcMethod("org_list")
	async listOrgs(ktx: ApiKtx, params: { matching?: any }) {
		const ctx = ktx.state.utx;
		const { matching } = params;

		let queryOptions: OrgQueryOptions = { access: 'org_a_content_view' };

		if (matching) {
			queryOptions.matching = matching;
		}

		const entities = await orgDao.list(ctx, queryOptions);
		return { success: true, data: entities };
	}

	@RpcMethod("org_get")
	async getOrg(ktx: ApiKtx, params: {name:string}) {
		const data = { type: 'org', ...params } as any;
		return getEntity(ktx, data); 
	}

	@RpcMethod("org_create")
	async createOrg(ktx: ApiKtx, params: {name:string}) {
		const data = { type: 'org', ...params } as any;
		return createEntity(ktx, data); 
	}

	@RpcMethod("org_update")
	async updateOrg(ktx: ApiKtx, params: {name:string}) {
		const data = { type: 'org', ...params } as any;
		return updateEntity(ktx, data); 
	}

	@RpcMethod("org_delete")
	async deleteOrg(ktx: ApiKtx, params: {name:string}) {
		const data = { type: 'org', ...params } as any;
		return deleteEntity(ktx, data); 
	}
}

// endregion: --- Org RPC Methods ---
