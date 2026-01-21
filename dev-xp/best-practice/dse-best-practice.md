# DSE (Data Service Endpoint) Best Practices

This document explains how to add and structure DSE methods (routers) in the web layer to process HTTP requests and call DAOs to access the database or other services.

## Overview

The web layer (`services/web-server/src/web/`) contains routers that handle HTTP requests and delegate business logic to the DAO layer. These routers are registered in the main application (`start.ts`).

## Key Concepts

### Router Classes

All DSE routers extend either:
- `ApiRouter` - For API endpoints that return JSON responses
- `AppRouter` - For application-level routes that may include redirects or other behaviors

### Route Decorators

Routes are defined using decorators:
- `@routeGet(path)` - Handles GET requests
- `@routePost(path)` - Handles POST requests
- `@routePatch(path)` - Handles PATCH requests
- `@routeDelete(path)` - Handles DELETE requests

### Context Access

Every route method receives an `ApiKtx` (or `Ktx`) parameter that provides:
- `ktx.state.utx` - User transaction context for database operations
- `ktx.params` - URL path parameters
- `ktx.query` - Query string parameters
- `ktx.request.body` - Request body data
- `ktx.request.files` - Uploaded files (for multipart requests)

## Creating a Basic DSE Router

### Step 1: Create the Router File

Create a new file in `services/web-server/src/web/` following the naming convention `dse-{entity}.ts`.

```ts
// <origin src="..." />
// (c) 2019 BriteSnow, inc - This code is licensed under MIT license (see LICENSE for details)

import { ApiKtx, ApiRouter, routeGet, routePost, routePatch, routeDelete } from '#common/web/koa-utils.js';
import { myEntityDao } from '#common/da/daos.js';

class MyEntityDse extends ApiRouter {

    @routeGet('/dse/MyEntity')
    async list(ktx: ApiKtx) {
        const ctx = ktx.state.utx;

        // Build query options
        let queryOptions: any = {};
        if (typeof ktx.query.matching == 'string') {
            queryOptions.matching = JSON.parse(ktx.query.matching);
        }

        const entities = await myEntityDao.list(ctx, queryOptions);

        return { success: true, data: entities };
    }

    @routeGet('/dse/MyEntity/:id')
    async get(ktx: ApiKtx) {
        const ctx = ktx.state.utx;
        const id = parseInt(ktx.params.id);

        const entity = await myEntityDao.get(ctx, id);

        return { success: true, data: entity };
    }

    @routePost('/dse/MyEntity')
    async create(ktx: ApiKtx) {
        const ctx = ktx.state.utx;
        const data = ktx.request.body as any;

        const id = await myEntityDao.create(ctx, data);
        const entity = await myEntityDao.get(ctx, id);

        return { success: true, data: entity };
    }

    @routePatch('/dse/MyEntity/:id')
    async update(ktx: ApiKtx) {
        const ctx = ktx.state.utx;
        const id = parseInt(ktx.params.id);
        const data = ktx.request.body as any;

        await myEntityDao.update(ctx, id, data);
        const entity = await myEntityDao.get(ctx, id);

        return { success: true, data: entity };
    }

    @routeDelete('/dse/MyEntity/:id')
    async delete(ktx: ApiKtx) {
        const ctx = ktx.state.utx;
        const id = parseInt(ktx.params.id);

        await myEntityDao.remove(ctx, id);

        return { success: true };
    }
}

export default function apiRouter(prefix?: string) { return new MyEntityDse(prefix) };
```

### Step 2: Register the Router

Add your router to the `apiMdws` array in `services/web-server/src/start.ts`:

```ts
import dseMyEntity from './web/dse-my-entity.js';

const app = new KoaApp({
    token_name: 'token',
    beforeAuthMdws: [
        routerAuthGoogleOAuth().middleware()
    ],
    apiMdws: [
        dseOrg('/api').middleware(),
        dseMedia('/api').middleware(),
        dseMyEntity('/api').middleware(),  // Add your router here
        dseGenerics('/api').middleware()
    ]
});
```

## Advanced Patterns

### Handling File Uploads

For endpoints that handle file uploads, access the file via `ktx.request.files`:

```ts
import { mediaDao } from '#common/da/daos.js';
import { Err } from '#common/error.js';
import { ApiKtx, ApiRouter, routePost, success } from '#common/web/koa-utils.js';
import { symbolDic } from '#common/utils.js';

const ERROR = symbolDic(
    'FILE_NOT_FOUND'
);

class MediaDse extends ApiRouter {

    @routePost('/dse/Media')
    async create(ktx: ApiKtx) {
        const utx = ktx.state.utx;
        const body = ktx.request.body as any;
        const projectId = body?.projectId;

        const file = ktx.request.files?.file;  // 'file' is the formData name

        if (file && !(file instanceof Array)) {
            const id = await mediaDao.createWithFile(utx, { file, projectId });
            const media = await mediaDao.get(utx, id);
            return success(media);
        } else {
            throw new Err(ERROR.FILE_NOT_FOUND, `Cannot create media, file not found`);
        }
    }
}
```

### Adding Custom Query Options

Override the list method to add entity-specific query options or access control:

```ts
import { OrgQueryOptions } from '#common/da/dao-org.js';
import { orgDao } from '#common/da/daos.js';
import { ApiKtx, ApiRouter, routeGet } from '#common/web/koa-utils.js';

class OrgDse extends ApiRouter {

    @routeGet('/dse/Org')
    async list(ktx: ApiKtx) {
        const ctx = ktx.state.utx;

        // Add default query options
        let queryOptions: OrgQueryOptions = { access: 'org_a_content_view' };

        if (typeof ktx.query.matching == 'string') {
            queryOptions.matching = JSON.parse(ktx.query.matching);
        }

        const entities = await orgDao.list(ctx, queryOptions);

        return { success: true, data: entities };
    }
}
```

### Error Handling

Use the `Err` class with symbolic error codes for consistent error handling:

```ts
import { Err } from '#common/error.js';
import { symbolDic } from '#common/utils.js';

const ERROR = symbolDic(
    'ENTITY_NOT_FOUND',
    'INVALID_PARAMETER'
);

@routeGet('/dse/MyEntity/:id')
async get(ktx: ApiKtx) {
    const ctx = ktx.state.utx;
    const id = parseInt(ktx.params.id);

    const entity = await myEntityDao.get(ctx, id);
    
    if (!entity) {
        throw new Err(ERROR.ENTITY_NOT_FOUND, `MyEntity with id ${id} not found`);
    }

    return { success: true, data: entity };
}
```

### Using the success Helper

For simple success responses, use the `success` helper function:

```ts
import { success } from '#common/web/koa-utils.js';

@routePost('/dse/MyEntity')
async create(ktx: ApiKtx) {
    const ctx = ktx.state.utx;
    const data = ktx.request.body as any;
    const id = await myEntityDao.create(ctx, data);
    const entity = await myEntityDao.get(ctx, id);
    return success(entity);  // Equivalent to { success: true, data: entity }
}
```

### Authentication Redirects

For routes that need to redirect after processing (like OAuth flows), use `ktx.redirect()`:

```ts
import { AppRouter, Ktx, routeGet, success } from '#common/web/koa-utils.js';

class AuthRouter extends AppRouter {

    @routeGet('/auth/callback')
    async callback(ktx: Ktx) {
        // Process authentication
        // ...

        // Redirect to home page after successful auth
        ktx.redirect('/');
    }
}
```

## Common Response Formats

### Success Response

```ts
return { success: true, data: entity };
// or
return success(entity);
```

### Success Response with No Data

```ts
return { success: true };
```

### Error Response

Errors are thrown automatically by the framework and formatted as:

```ts
throw new Err(ERROR_CODE, 'Error message');
```

## Best Practices

1. **Type Safety**: Define TypeScript interfaces for your request bodies and query options when possible.

2. **Parameter Validation**: Always validate and sanitize input parameters before passing them to DAOs.

3. **Context Propagation**: Always pass `ctx` (user transaction context) to DAO methods.

4. **Error Codes**: Use symbolic error codes for consistent error handling across the application.

5. **Route Naming**: Follow the convention `/dse/{EntityName}` for standard CRUD operations.

6. **Path Parameters**: Use `parseInt()` for numeric path parameters.

7. **Query Parsing**: When parsing JSON from query strings, wrap in `typeof ... == 'string'` checks.

8. **File Handling**: Check that file objects are not arrays before processing single file uploads.

9. **Access Control**: Add appropriate access control options to query parameters when listing entities.

10. **Return Complete Entities**: After create or update operations, return the complete entity by fetching it from the database.

## Generic vs Specialized Routers

### Use Generic Router (dse-generics.ts)

When your entity needs standard CRUD operations without special logic, you can simply add it to the `daoByEntity` registry in `dse-generics.ts`:

```ts
const daoByEntity: { [type: string]: BaseDao<any, any> } = {
    User: userDao,
    Org: orgDao,
    Wks: wksDao,
    Project: projectDao,
    Media: mediaDao,
    MyEntity: myEntityDao  // Add your DAO here
};
```

### Use Specialized Router

Create a specialized router when you need to:
- Handle file uploads
- Add custom query options or access control
- Implement non-standard CRUD operations
- Override default behavior
- Add validation or transformation logic

## Utilities

The `web-commons.ts` file contains shared utility functions for routers. For example, extracting context from requests:

```ts
import { getWksFromReq } from './web/web-commons.js';

@routeGet('/dse/Ticket')
async list(ktx: ApiKtx) {
    const wks = await getWksFromReq(ktx);
    // Use wks for query options
}
```

## Order of Router Registration

Router registration order in `start.ts` matters. More specific routes should be registered before generic ones to ensure proper route matching:

```ts
apiMdws: [
    dseOrg('/api').middleware(),      // Specific Org routes
    dseMedia('/api').middleware(),    // Specific Media routes
    dseGenerics('/api').middleware()  // Generic fallback routes
]
```
