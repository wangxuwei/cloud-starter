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

	@RpcMethod("list_projects")
	async listProjects(ktx: ApiKtx, params: { matching?: any }) {
		const data = { type: 'project', ...params } as any;
		return listEntities(ktx, data); 
	}

	@RpcMethod("get_project")
	async getProject(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'project', ...params } as any;
		return getEntity(ktx, data); 
	}

	@RpcMethod("create_project")
	async createProject(ktx: ApiKtx, params: { data: Partial<Project>}) {
		const data = { type: 'project', ...params } as any;
		return createEntity(ktx, data); 
	}

	@RpcMethod("update_project")
	async updateProject(ktx: ApiKtx, params: { id:number, data: Partial<Project>}) {
		const data = { type: 'project', ...params } as any;
		return updateEntity(ktx, data); 
	}

	@RpcMethod("delete_project")
	async deleteProject(ktx: ApiKtx, params: { id:number }) {
		const data = { type: 'project', ...params } as any;
		return deleteEntity(ktx, data); 
	}

}

// endregion: --- Project RPC Methods ---
