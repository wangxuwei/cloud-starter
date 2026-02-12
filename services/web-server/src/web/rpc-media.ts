// <origin src="services/web-server/src/web/rpc-media.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// RPC handlers for media operations
// Methods marked with @RpcMethod are automatically registered
////

import { ApiKtx } from '#common/web/koa-utils.js';
import { RpcMethod } from '#common/web/rpc.js';
import { Media } from '#shared/entities.js';
import { deleteEntity, getEntity, listEntities, updateEntity } from './rpc-generics.js';

// region:    --- Media RPC Methods ---

class RpcHandlers{

	@RpcMethod("media_list")
	async listMedias(ktx: ApiKtx, params: { matching?: any }) {
		const data = { type: 'media', ...params } as any;
		return listEntities(ktx, data); 
	}

	@RpcMethod("media_get")
	async getMedia(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'media', ...params } as any;
		return getEntity(ktx, data); 
	}

	@RpcMethod("media_update")
	async updateMedia(ktx: ApiKtx, params: { id:number, data: Partial<Media>}) {
		const data = { type: 'media', ...params } as any;
		return updateEntity(ktx, data); 
	}

	@RpcMethod("media_delete")
	async deleteMedia(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'media', ...params } as any;
		return deleteEntity(ktx, data); 
	}

}

// endregion: --- Media RPC Methods ---

