// <origin src="services/web-server/src/web/rpc-generics.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

import { BaseDao } from "#common/da/dao-base.js";
import {
	assetDao,
	orgDao,
	projectDao,
	userDao,
	wksDao,
} from "#common/da/daos.js";
import { ApiKtx, success } from "#common/web/koa-utils.js";

// region:    --- DAO Registry ---

/**
 * Dao Registry per entity name exposed for generic RPC operations.
 * Note: This makes sure only explicitly exposed DAO are available via web API.
 */
const daoByEntity: { [type: string]: BaseDao<any, any> } = {
	user: userDao,
	org: orgDao,
	wks: wksDao,
	project: projectDao,
	asset: assetDao,
};

// endregion: --- DAO Registry ---

// region:    --- Generic Entity CRUD RPC Methods ---
export async function listEntities(
	ktx: ApiKtx,
	params: { type: string; filters?: any; includes?: any }
) {
	const ctx = ktx.state.utx;
	const { type, filters, includes } = params;

	const dao = daoByEntity[type];
	if (!dao) {
		throw new Error(`Invalid entity type: ${type}`);
	}

	let queryOptions: any = {};
	if (filters) {
		queryOptions.filters = filters;
	}

	if (includes) {
		queryOptions.includes = includes;
	}

	const entities = await dao.list(ctx, queryOptions);
	return success(entities);
}

export async function getEntity(
	ktx: ApiKtx,
	params: { type: string; id: number }
) {
	const ctx = ktx.state.utx;
	const { type, id } = params;

	const dao = daoByEntity[type];
	if (!dao) {
		throw new Error(`Invalid entity type: ${type}`);
	}

	const entity = await dao.get(ctx, id);
	return success(entity);
}

export async function createEntity(
	ktx: ApiKtx,
	params: { type: string; data: any }
) {
	const ctx = ktx.state.utx;
	const { type, data } = params;

	const dao = daoByEntity[type];
	if (!dao) {
		throw new Error(`Invalid entity type: ${type}`);
	}

	const id = await dao.create(ctx, data);
	const entity = await dao.get(ctx, id);
	return success(entity);
}

export async function updateEntity(
	ktx: ApiKtx,
	params: { type: string; id: number; data: any }
) {
	const ctx = ktx.state.utx;
	const { type, id, data } = params;

	const dao = daoByEntity[type];
	if (!dao) {
		throw new Error(`Invalid entity type: ${type}`);
	}

	await dao.update(ctx, id, data);
	const entity = await dao.get(ctx, id);
	return success(entity);
}

export async function deleteEntity(
	ktx: ApiKtx,
	params: { type: string; id: number }
) {
	const ctx = ktx.state.utx;
	const { type, id } = params;

	const dao = daoByEntity[type];
	if (!dao) {
		throw new Error(`Invalid entity type: ${type}`);
	}

	await dao.remove(ctx, id);
	return success();
}

// endregion: --- Generic Entity CRUD RPC Methods ---
