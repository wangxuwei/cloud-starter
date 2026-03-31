// <origin src="services/web-server/src/web/rpc-asset.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// RPC handlers for asset operations
// Methods marked with @RpcMethod are automatically registered
////

import { ApiKtx } from '#common/web/koa-utils.js';
import { RpcMethod } from '#common/web/rpc.js';
import { Asset } from '#shared/entities.js';
import { deleteEntity, getEntity, listEntities, updateEntity } from './rpc-generics.js';

// region:    --- Asset RPC Methods ---

class RpcHandlers{

	@RpcMethod("asset_list")
	async listAssets(ktx: ApiKtx, params: { filters?: any }) {
		const data = { type: 'asset', ...params } as any;
		return listEntities(ktx, data); 
	}

	@RpcMethod("asset_get")
	async getAsset(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'asset', ...params } as any;
		return getEntity(ktx, data); 
	}

	@RpcMethod("asset_update")
	async updateAsset(ktx: ApiKtx, params: { id:number, data: Partial<Asset>}) {
		const data = { type: 'asset', ...params } as any;
		return updateEntity(ktx, data); 
	}

	@RpcMethod("asset_delete")
	async deleteAsset(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'asset', ...params } as any;
		return deleteEntity(ktx, data); 
	}

}

// endregion: --- Asset RPC Methods ---

