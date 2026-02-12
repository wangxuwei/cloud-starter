// <origin src="services/web-server/src/web/rpc-project.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// RPC handlers for project operations
// Methods marked with @RpcMethod are automatically registered
////

import { ApiKtx } from '#common/web/koa-utils.js';
import { RpcMethod } from '#common/web/rpc.js';
import { Project } from '#shared/entities.js';
import { createEntity, deleteEntity, getEntity, listEntities, updateEntity } from './rpc-generics.js';

// region:    --- Project RPC Methods ---

class RpcHandlers{

	@RpcMethod("project_list")
	async listProjects(ktx: ApiKtx, params: { matching?: any }) {
		const data = { type: 'project', ...params } as any;
		return listEntities(ktx, data); 
	}

	@RpcMethod("project_get")
	async getProject(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'project', ...params } as any;
		return getEntity(ktx, data); 
	}

	@RpcMethod("project_create")
	async createProject(ktx: ApiKtx, params: { data: Partial<Project>}) {
		const data = { type: 'project', ...params } as any;
		return createEntity(ktx, data); 
	}

	@RpcMethod("project_update")
	async updateProject(ktx: ApiKtx, params: { id:number, data: Partial<Project>}) {
		const data = { type: 'project', ...params } as any;
		return updateEntity(ktx, data); 
	}

	@RpcMethod("project_delete")
	async deleteProject(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'project', ...params } as any;
		return deleteEntity(ktx, data); 
	}

}

// endregion: --- Project RPC Methods ---
