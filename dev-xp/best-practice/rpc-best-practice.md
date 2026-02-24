# RPC Best Practices

This document explains how to add and structure RPC (Remote Procedure Call) handlers using JSON-RPC 2.0 in the web layer to process requests and call DAOs to access the database or other services.

## Overview

The web layer (`services/web-server/src/web/`) contains RPC handlers that process JSON-RPC 2.0 requests and delegate business logic to the DAO layer. These handlers use the `@RpcMethod` decorator for automatic registration.

## Key Concepts

### JSON-RPC 2.0

The system implements the JSON-RPC 2.0 protocol, which provides a standardized way to make remote procedure calls using JSON. Each RPC request includes:
- `jsonrpc`: Always "2.0"
- `method`: The name of the method to call
- `params`: Parameters for the method (array or object)
- `id`: Request identifier for response matching

### @RpcMethod Decorator

The `@RpcMethod` decorator automatically registers a function or class method as an RPC handler. It takes the method name as a parameter.

### RpcRouter Class

The `RpcRouter` class extends `AppRouter` and handles all incoming RPC requests at the `/rpc` endpoint, dispatching them to registered handlers.

### Global Handler Registry

All RPC methods are registered in a global `Map<string, RpcHandler>`, allowing handlers to be defined across multiple files and automatically discovered.

### Context Access

Every RPC handler receives:
- `ktx: ApiKtx` - The API context containing user transaction context (`ktx.state.utx`)
- `params: TParams` - The parameters passed in the RPC request

## Creating a Basic RPC Handler

### Step 1: Create the Handler File

Create a new file in `services/web-server/src/web/` following the naming convention `rpc-{entity}.ts`.

```ts
// <origin src="services/web-server/src/web/rpc-my-entity.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

import { ApiKtx } from '#common/web/koa-utils.js';
import { RpcMethod } from '#common/web/rpc.js';
import { myEntityDao } from '#common/da/daos.js';
import { success } from '#common/web/koa-utils.js';

// region:    --- MyEntity RPC Methods ---

class RpcHandlers{

	@RpcMethod("myentity_list")
	async listMyEntities(ktx: ApiKtx, params: { filters?: any }) {
		const ctx = ktx.state.utx;
		const { filters } = params;

		let queryOptions: any = {};
		if (filters) {
			queryOptions.filters = filters;
		}

		const entities = await myEntityDao.list(ctx, queryOptions);
		return success(entities);
	}

	@RpcMethod("myentity_get")
	async getMyEntity(ktx: ApiKtx, params: { id: number }) {
		const ctx = ktx.state.utx;
		const { id } = params;

		const entity = await myEntityDao.get(ctx, id);
		return success(entity);
	}

	@RpcMethod("myentity_create")
	async createMyEntity(ktx: ApiKtx, params: { data: any }) {
		const ctx = ktx.state.utx;
		const { data } = params;

		const id = await myEntityDao.create(ctx, data);
		const entity = await myEntityDao.get(ctx, id);
		return success(entity);
	}

	@RpcMethod("myentity_update")
	async updateMyEntity(ktx: ApiKtx, params: { id: number; data: any }) {
		const ctx = ktx.state.utx;
		const { id, data } = params;

		await myEntityDao.update(ctx, id, data);
		const entity = await myEntityDao.get(ctx, id);
		return success(entity);
	}

	@RpcMethod("myentity_delete")
	async deleteMyEntity(ktx: ApiKtx, params: { id: number }) {
		const ctx = ktx.state.utx;
		const { id } = params;

		await myEntityDao.remove(ctx, id);
		return success();
	}
}

// endregion: --- MyEntity RPC Methods ---
```

### Step 2: Register the RPC Router

Add the RPC router to the `apiMdws` array in `services/web-server/src/start.ts`:

```ts
import { RpcRouter } from '#common/web/rpc.js';
import './web/rpc-my-entity.js';  // Import to register handlers

const app = new KoaApp({
    token_name: 'token',
    beforeAuthMdws: [
        routerAuthGoogleOAuth().middleware()
    ],
    apiMdws: [
        new RpcRouter('/rpc').middleware(),  // Add RPC router
    ]
});
```

**Important:** Simply importing the RPC handler files (e.g., `import './web/rpc-my-entity.js'`) is enough to register the methods. The decorator handles registration automatically.

## Request and Response Formats

### RPC Request

```json
{
  "jsonrpc": "2.0",
  "method": "myentity_get",
  "params": { "id": 123 },
  "id": "request-1"
}
```

### Success Response

```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "data": { "id": 123, "name": "Example" }
  },
  "id": "request-1"
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method \"unknown_method\" not found"
  },
  "id": "request-1"
}
```

## Standard Error Codes

The system uses JSON-RPC 2.0 standard error codes:

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse Error | Invalid JSON was received |
| -32600 | Invalid Request | The JSON sent is not a valid Request object |
| -32601 | Method Not Found | The method does not exist |
| -32602 | Invalid Params | Invalid method parameter(s) |
| -32603 | Internal Error | Internal JSON-RPC error |

## Decorator Patterns

### Class Method Decorator

The most common pattern is using `@RpcMethod` on class methods:

```ts
class RpcHandlers {
	@RpcMethod("user_get")
	async getUser(ktx: ApiKtx, params: { id: number }) {
		// handler implementation
	}
}
```

### Standalone Function Decorator

You can also decorate standalone functions:

```ts
@RpcMethod("system_version")
async getVersion(ktx: ApiKtx, params: any) {
	return { version: '1.0.0' };
}
```

### Custom Method Names

Use the decorator parameter to specify a different RPC method name than the function name:

```ts
@RpcMethod("customMethodName")
async someInternalFunctionName(ktx: ApiKtx, params: any) {
	// This will be registered as "customMethodName"
}
```

## Generic CRUD Handlers

The system provides generic CRUD handlers in `rpc-generics.ts` that can be reused for standard operations. This avoids code duplication for entities that follow common patterns.

### Using Generic Handlers

First, add your DAO to the registry:

```ts
// In rpc-generics.ts
const daoByEntity: { [type: string]: BaseDao<any, any> } = {
	user: userDao,
	org: orgDao,
	wks: wksDao,
	project: projectDao,
	media: mediaDao,
	myEntity: myEntityDao  // Add your DAO here
};
```

Then, create wrapper methods:

```ts
import { createEntity, deleteEntity, getEntity, listEntities, updateEntity } from './rpc-generics.js';

class RpcHandlers{
	@RpcMethod("myentity_list")
	async listMyEntities(ktx: ApiKtx, params: { filters?: any }) {
		const data = { type: 'myentity', ...params } as any;
		return listEntities(ktx, data); 
	}

	@RpcMethod("myentity_get")
	async getMyEntity(ktx: ApiKtx, params: { id: number }) {
		const data = { type: 'myentity', ...params } as any;
		return getEntity(ktx, data); 
	}

	@RpcMethod("myentity_create")
	async createMyEntity(ktx: ApiKtx, params: { data: any }) {
		const data = { type: 'myentity', ...params } as any;
		return createEntity(ktx, data); 
	}

	@RpcMethod("myentity_update")
	async updateMyEntity(ktx: ApiKtx, params: { id: number; data: any }) {
		const data = { type: 'myentity', ...params } as any;
		return updateEntity(ktx, data); 
	}

	@RpcMethod("myentity_delete")
	async deleteMyEntity(ktx: ApiKtx, params: { id: number }) {
		const data = { type: 'myentity', ...params } as any;
		return deleteEntity(ktx, data); 
	}
}
```

### Custom Query Options

When you need entity-specific query options or access control, override the generic list method:

```ts
import { OrgQueryOptions } from '#common/da/dao-org.js';
import { orgDao } from '#common/da/daos.js';

class RpcHandlers{
	@RpcMethod("org_list")
	async listOrgs(ktx: ApiKtx, params: { filters?: any }) {
		const ctx = ktx.state.utx;
		const { filters } = params;

		// Add default access control
		let queryOptions: OrgQueryOptions = { access: 'org_a_content_view' };

		if (filters) {
			queryOptions.filters = filters;
		}

		const entities = await orgDao.list(ctx, queryOptions);
		return { success: true, data: entities };
	}
}
```

## Advanced Patterns

### Error Handling

Use the `Err` class for consistent error handling. Errors thrown in handlers are caught by the RPC router and returned as JSON-RPC errors:

```ts
import { Err } from '#common/error.js';
import { symbolDic } from '#common/utils.js';

const ERROR = symbolDic(
	'ENTITY_NOT_FOUND',
	'INVALID_PARAMETER'
);

@RpcMethod("myentity_get")
async getMyEntity(ktx: ApiKtx, params: { id: number }) {
	const ctx = ktx.state.utx;
	const { id } = params;

	const entity = await myEntityDao.get(ctx, id);
	
	if (!entity) {
		throw new Err(ERROR.ENTITY_NOT_FOUND, `MyEntity with id ${id} not found`);
	}

	return success(entity);
}
```

### Typed Parameters

Define TypeScript interfaces for parameters to improve type safety:

```ts
interface MyEntityCreateParams {
	name: string;
	description?: string;
	projectId: number;
}

@RpcMethod("myentity_create")
async createMyEntity(ktx: ApiKtx, params: MyEntityCreateParams) {
	const ctx = ktx.state.utx;
	const id = await myEntityDao.create(ctx, params);
	return success(await myEntityDao.get(ctx, id));
}
```

### Using Query Options

Leverage the QueryOptions pattern for flexible filtering:

```ts
@RpcMethod("media_list")
async listMedias(ktx: ApiKtx, params: { 
	filters?: any; 
	limit?: number; 
	offset?: number;
}) {
	const ctx = ktx.state.utx;
	
	let queryOptions: any = {};
	
	if (params.filters) {
		queryOptions.filters = params.filters;
	}
	
	if (params.limit || params.offset) {
		queryOptions.list_options = {
			limit: params.limit,
			offset: params.offset
		};
	}

	const entities = await mediaDao.list(ctx, queryOptions);
	return success(entities);
}
```

### File Uploads via RPC

For RPC handlers that need to work with files, use multipart requests and access files via the DAO layer:

```ts
@RpcMethod("media_create")
async createMedia(ktx: ApiKtx, params: { 
	projectId: number; 
	fileData?: string; 
	mimeType?: string;
}) {
	const ctx = ktx.state.utx;
	const { projectId, fileData, mimeType } = params;

	if (!fileData) {
		throw new Error('fileData is required');
	}

	const id = await mediaDao.createWithData(ctx, {
		projectId,
		fileData,
		mimeType
	});

	return success(await mediaDao.get(ctx, id));
}
```

## Best Practices

1. **Method Naming Convention**: Use `{entity}_{action}` format for RPC method names (e.g., `user_get`, `media_list`, `project_create`).

2. **Parameter Types**: Define TypeScript interfaces for parameters to ensure type safety.

3. **Return Format**: Always use the `success()` helper or return `{ success: true, data: ... }` for consistent responses.

4. **Error Handling**: Throw `Err` objects with symbolic error codes for consistent error reporting.

5. **DAO Access**: Always pass `ktx.state.utx` (user transaction context) to DAO methods.

6. **Return Complete Entities**: After create/update operations, fetch and return the complete entity.

7. **Generic Reuse**: Use generic handlers from `rpc-generics.ts` when appropriate to avoid code duplication.

8. **Handler Organization**: Group related handlers in a single class with region markers for better code organization.

9. **Import Side Effects**: Remember that importing handler files (e.g., `import './web/rpc-my-entity.js'`) is sufficient for registration; no additional setup is needed.

10. **Validation**: Validate parameters before passing to DAOs, especially for IDs and required fields.

11. **Filter Support**: Support `filters` parameter in list methods to enable client-side filtering using the QueryOptions pattern.

12. **Async Handlers**: All RPC handlers must be async functions or methods to handle database operations properly.

13. **Region Markers**: Use `// region:` and `// endregion:` comments to organize related RPC methods within a class.

14. **Consistent Returns**: Return success even when no data is expected (e.g., delete operations) using `success()`.


### Testing with Authentication

```bash
# Include authentication cookie
curl -X POST http://localhost:3000/rpc \
  -H "Content-Type: application/json" \
  --cookie "token=your-auth-token" \
  -d '{
    "jsonrpc": "2.0",
    "method": "user_list",
    "params": {},
    "id": "1"
  }'
```

## Client-Side Usage

### Using DCO (Data Client Object)

The recommended client-side pattern uses DCO (Data Client Object) classes that wrap RPC calls with type safety and automatic hub events for UI reactivity.

#### Creating a DCO

Create a DCO in `frontends/web/src/dcos.ts`:

```ts
import { BaseDco } from './dco-base.js';
import { Wks, QueryOptions } from 'shared/entities.js';

export const wksDco = new BaseDco<Wks, QueryOptions<Wks>>('wks');
```

For entities with custom operations, extend the BaseDco:

```ts
class MediaDao extends BaseDco<Media, QueryOptions<Media>> {
	constructor() { super('media') }

	async listImages(projectId: number): Promise<Media[]> {
		return super.list({ filters: { type: 'image', projectId } });
	}

	async listVideos(projectId: number): Promise<Media[]> {
		return super.list({ filters: { type: 'video', projectId } });
	}

	async create(props: any & { file?: File }): Promise<Media> {
		const file = props.file;
		if (file) {
			const formData = new FormData();
			for(const prop in props){
				formData.append(prop, props[prop]);
			}
			const webResult = await webRequest('POST', '/api/upload-media', { body: formData });
			const media = (webResult.success) ? webResult.data as Media : null;

			if (media == null) {
				throw new Error(`MediaDao.create could not create the new media for ${file.name}`);
			}

			dcoHub.pub(this.cmd_suffix, 'create', media);
			return media;
		} else {
			return super.create(props);
		}
	}
}

export const mediaDco = new MediaDao();
```

#### Using DCO Methods

DCOs provide standard CRUD operations:

```ts
// Get a single entity
const wks = await wksDco.get(1);

// List all entities or with filters
const allWkss = await wksDco.list();
const filteredWkss = await wksDco.list({ filters: { status: 'active' } });

// Create a new entity
const newWks = await wksDco.create({ name: 'My Workspace', description: 'A cool workspace' });

// Update an entity
await wksDco.update(1, { name: 'Updated Workspace' });

// Delete an entity
await wksDco.delete(1);
```

#### DCO Hub Events

DCOs automatically publish events to the `dcoHub` after create/update/delete operations, enabling reactive UI updates:

```ts
import { dcoHub } from './dco-base.js';

// Subscribe to workspace events
dcoHub.sub('wks', 'create', (data: Wks) => {
	console.log('Workspace created:', data);
	// Update UI to reflect new workspace
});

dcoHub.sub('wks', 'update', (data: Wks) => {
	console.log('Workspace updated:', data);
	// Update UI to reflect changes
});

dcoHub.sub('wks', 'delete', (success: boolean) => {
	console.log('Workspace deleted');
	// Update UI to remove deleted workspace
});
```

#### Type Safety

DCOs are fully typed, providing compile-time safety:

```ts
// TypeScript knows this returns Wks
const wks: Wks = await wksDco.get(1);

// TypeScript enforces correct parameter types
await wksDco.update(1, { name: 'New Name' });  // Valid
await wksDco.update(1, { invalid: true });      // Type error

// TypeScript knows the return type
const list: Wks[] = await wksDco.list();
```

### Making Direct RPC Requests (Low-Level)

For cases where you need direct control over RPC calls, use the `rpc_invoke` function:

```ts
import { rpc_invoke } from 'common/rpc.js';

async function callRpc(method: string, params: any = {}) {
	const result = await rpc_invoke(method, params);
	
	if (!result.success) {
		throw result;
	}
	
	return result.data;
}

// Usage examples
const entities = await callRpc('myentity_list', { filters: { status: 'active' } });
const entity = await callRpc('myentity_get', { id: 123 });
const created = await callRpc('myentity_create', { data: { name: 'New Entity' } });
```

### Making Manual Fetch Requests (Low-Level)

For complete control, you can use fetch directly:

```ts
async function callRpcWithFetch(method: string, params: any = {}) {
	const response = await fetch('/rpc', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			method,
			params,
			id: Date.now().toString()
		})
	});

	const result = await response.json();
	
	if (result.error) {
		throw new Error(result.error.message);
	}
	
	return result.result;
}

// Usage
const data = await callRpcWithFetch('myentity_get', { id: 123 });
```

### When to Use Each Approach

| Approach | Use When |
|----------|----------|
| **DCO** | Most common cases. Provides type safety, automatic events, and standard CRUD operations. |
| **rpc_invoke** | Custom operations not covered by DCO, one-off calls, or when you don't need hub events. |
| **Fetch** | Need complete control over request headers, options, or special error handling. |

## Performance Considerations

1. **Connection Pooling**: The RPC layer uses the same database connection pool as DSE endpoints.

2. **Middleware Chain**: RPC requests go through the same middleware chain (auth, logging, error handling) as other API endpoints.

3. **Response Size**: Be mindful of response sizes for list operations. Use pagination (`limit`/`offset`) for large datasets.

4. **Caching**: Unlike REST endpoints with HTTP caching, RPC responses are not cached by browsers. Implement application-level caching if needed.

5. **Error Overhead**: Throwing errors in RPC handlers is fine, but avoid excessive error logging for expected failures (e.g., "not found").
