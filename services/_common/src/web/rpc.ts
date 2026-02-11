// <origin src="services/_common/src/web/rpc.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// Module responsible for handling JSON-RPC 2.0 requests
// Supports registering RPC methods using @RpcMethod decorator on functions
////

import { AppRouter, routePost } from './koa-utils.js';

// region:    --- Types ---

export interface RpcRequest {
	jsonrpc: '2.0';
	method: string;
	params?: any[] | object;
	id?: string | number | null;
}

export interface RpcResponseSuccess {
	jsonrpc: '2.0';
	result: any;
	id: string | number | null;
}

export interface RpcResponseError {
	jsonrpc: '2.0';
	error: {
		code: number;
		message: string;
		data?: any;
	};
	id: string | number | null;
}

export type RpcResponse = RpcResponseSuccess | RpcResponseError;

export interface RpcHandler<TParams = any> {
	(ktx: any, params: TParams): Promise<any> | any;
}
// endregion: --- Types ---

// region:    --- RPC Methods Registry ---

const rpcHandlersRegistry = new Map<string, RpcHandler>();

/**
 * Register an RPC method with a handler function.
 * 
 * @param name The RPC method name
 * @param handler The handler function for this RPC method
 */
export function registerRpcMethod(name: string, handler: RpcHandler) {
	rpcHandlersRegistry.set(name, handler);
}

/**
 * Get the RPC handlers registry (for internal use by router)
 */
function getRpcHandlersRegistry() {
	return rpcHandlersRegistry;
}

// endregion: --- RPC Methods Registry ---

// region:    --- RpcMethod Decorator ---

/**
 * Decorator to register a function as an RPC method handler.
 * 
 * Usage patterns:
 * 1. @RpcMethod('getVersion') - custom name
 * 2. @RpcMethod('getUser') - custom name
 * 
 * @example Using decorator on a class method:
 * ```ts
 * class MyRpcHandlers {
 *     @RpcMethod('getVersion')
 *     async versionHandler(ktx: Ktx, params: any) {
 *         return { version: '1.0.0' };
 *     }
 * }
 * ```
 * 
 * @example Using decorator on a named function:
 * ```ts
 * @RpcMethod('getUser')
 * async function getUserHandler(ktx: ApiKtx, params: { id: string }) {
 *     return userDao.get(ktx.state.utx, params.id);
 * }
 * ```
 */
export function RpcMethod(name: string): any {
	return function (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): any {
		if (descriptor) {
			registerRpcMethod(name, target[propertyKey as string].bind(target));
			return descriptor;
		} else if (typeof target === 'function') {
			registerRpcMethod(name, target);
			return target;
		}
	};
}

// endregion: --- RpcMethod Decorator ---

// region:    --- RpcRouter Class ---

/**
 * RPC Router that inherits from AppRouter.
 * Handles JSON-RPC 2.0 requests for registered methods.
 * 
 * @param prefix The URL prefix for RPC endpoints (e.g., '/rpc', '/prpc', '/wapi')
 */
export class RpcRouter extends AppRouter {
	constructor(prefix: string) {
		super(prefix);
	}

	@routePost('/rpc')
	async handleRpcRequest(ktx: any) {
		const registry = getRpcHandlersRegistry();

		try {
			const rpcReq = ktx.request.body as any as RpcRequest;

			if (rpcReq.jsonrpc !== '2.0') {
				ktx.body = buildError(null, -32600, 'Invalid Request: missing or invalid jsonrpc version');
				return;
			}

			let methodName = rpcReq.method;

			if (typeof methodName !== 'string') {
				ktx.body = buildError(null, -32600, 'Invalid Request: method must be a string');
				return;
			}

			const handler = registry.get(methodName);

			if (!handler) {
				ktx.body = buildError(rpcReq.id!, -32601, `Method "${methodName}" not found`);
				return;
			}

			const result = await handler(ktx, rpcReq.params);
			ktx.body = buildSuccess(rpcReq.id!, result);

		} catch (ex: any) {
			console.log(ex);
			const errorMessage = ex?.message || 'Internal error';
			ktx.body = buildError(null, -32603, errorMessage);
		}
	}
}

// endregion: --- RpcRouter Class ---

function buildSuccess(id: string | number | null, result: any): RpcResponseSuccess {
	return {
		jsonrpc: '2.0',
		result,
		id
	};
}

function buildError(id: string | number | null, code: number, message: string, data?: any): RpcResponseError {
	return {
		jsonrpc: '2.0',
		error: {
			code,
			message,
			data
		},
		id
	};
}

// region:    --- RPC Error Codes ---

/**
 * Standard JSON-RPC 2.0 error codes
 */
export const RpcErrorCode = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603
} as const;

// endregion: --- RPC Error Codes ---
