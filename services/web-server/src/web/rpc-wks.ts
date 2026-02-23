// <origin src="services/web-server/src/web/rpc-wks.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// RPC handlers for workspace operations
// Methods marked with @RpcMethod are automatically registered
////

import { ApiKtx } from '#common/web/koa-utils.js';
import { RpcMethod } from '#common/web/rpc.js';
import { Wks } from '#shared/entities.js';
import { createEntity, deleteEntity, getEntity, listEntities, updateEntity } from './rpc-generics.js';

// region:    --- Wks RPC Methods ---

class RpcHandlers{

	@RpcMethod("wks_list")
	async listWkss(ktx: ApiKtx, params: { filters?: any }) {
		const data = { type: 'wks', ...params } as any;
		return listEntities(ktx, data); 
	}

	@RpcMethod("wks_get")
	async getWks(ktx: ApiKtx, params: {id:number}) {
		const data = { type: 'wks', ...params } as any;
		return getEntity(ktx, data); 
	}

	@RpcMethod("wks_create")
	async createWks(ktx: ApiKtx, params: {data: Partial<Wks>}) {
		const data = { type: 'wks', ...params } as any;
		return createEntity(ktx, data); 
	}

	@RpcMethod("wks_update")
	async updateWks(ktx: ApiKtx, params: {id:number, data: Partial<Wks>}) {
		const data = { type: 'wks', ...params } as any;
		return updateEntity(ktx, data); 
	}

	@RpcMethod("wks_delete")
	async deleteWks(ktx: ApiKtx, params: {id:number}) {
		const data = { type: 'wks', ...params } as any;
		return deleteEntity(ktx, data); 
	}
}

// endregion: --- Wks RPC Methods ---
