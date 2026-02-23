# DCO (Data Client Object) Best Practices

## Overview

DCO (Data Client Object) is the client-side layer that processes HTTP requests to the server, calling routers or DSE (Data Service Endpoints) on the server side. DCOs provide a consistent interface for CRUD operations and can be extended for custom functionality.

## Basic Structure

### Base DCO Class

All DCOs extend `BaseDco<E, F>` where:
- `E` is the entity type
- `F` is the filter/query options type

The base class provides standard CRUD operations:
- `get(id)` - Retrieve a single entity by ID
- `list(filter?)` - List entities with optional filter
- `create(props)` - Create a new entity
- `update(id, props)` - Update an existing entity
- `remove(id)` - Delete an entity

### DCO Hub

DCOs publish events through `dcoHub` when data changes:
- `dcoHub.pub(entityType, 'create', entity)`
- `dcoHub.pub(entityType, 'update', entity)`
- `dcoHub.pub(entityType, 'remove', id)`

Components can subscribe to these events to react to data changes.

## Creating Simple DCOs

For straightforward entities with no special behavior, create a simple DCO:

```ts
import { BaseDco } from './dco-base.js';
import { Wks, QueryOptions } from 'shared/entities.js';

export const wksDco = new BaseDco<Wks, QueryOptions<Wks>>('Wks');
```

Use the entity name string exactly as it appears on the server side.

## Creating Custom DCO Classes

When you need special behavior (file uploads, custom methods, etc.), create a class that extends `BaseDco`:

```ts
import { BaseDco, dcoHub } from './dco-base.js';
import { Media, QueryOptions } from 'shared/entities.js';

class MediaDao extends BaseDco<Media, QueryOptions<Media>> {
  constructor() {
    super('Media');
  }

  // Custom methods go here
}

export const mediaDco = new MediaDao();
```

## Adding Custom Methods

### Convenience Query Methods

Add methods that provide commonly used queries with predefined filters:

```ts
class MediaDao extends BaseDco<Media, QueryOptions<Media>> {
  constructor() {
    super('Media');
  }

  async listImages(): Promise<Media[]> {
    return super.list({ filters: { type: 'image' } });
  }

  async listVideos(): Promise<Media[]> {
    return super.list({ filters: { type: 'video' } });
  }
}
```

### Override Base Methods

Override base methods when you need special handling, such as file uploads:

```ts
class MediaDao extends BaseDco<Media, QueryOptions<Media>> {
  constructor() {
    super('Media');
  }

  async create(props: any & { file?: File }): Promise<Media> {
    const file = props.file;

    if (file) {
      // Special handling for file uploads
      const formData = new FormData();
      formData.append('file', file);

      const webResult = await webRequest('POST', '/api/dse/Media', {
        body: formData
      });

      const media = webResult.success ? webResult.data as Media : null;

      if (media == null) {
        throw new Error(`Could not create media for ${file.name}`);
      }

      // Publish the event manually
      dcoHub.pub(this._entityType, 'create', media);
      return media;

    } else {
      // Use default behavior
      return super.create(props);
    }
  }
}
```

## Event Publishing

When overriding methods that modify data, always publish events to notify subscribers:

```ts
dcoHub.pub(this._entityType, 'create', entity);
dcoHub.pub(this._entityType, 'update', entity);
dcoHub.pub(this._entityType, 'remove', id);
```

Use `this._entityType` to ensure consistency with the base class behavior.

## Error Handling

DCO methods should throw errors when operations fail. The base `webGet`, `webPost`, `webPatch`, and `webDelete` functions return results with a `success` flag.

### Pattern 1: Throw the result directly

```ts
async get(id: number): Promise<E> {
  const result = await webGet(`/api/dse/${this._entityType}/${id}`);
  if (result.success) {
    return result.data;
  } else {
    throw result; // Contains error details
  }
}
```

### Pattern 2: Throw a custom error

```ts
async create(props: any): Promise<E> {
  const webResult = await webRequest('POST', '/api/dse/Media', {
    body: formData
  });

  const media = webResult.success ? webResult.data as Media : null;

  if (media == null) {
    throw new Error(`Could not create media for ${file.name}`);
  }

  return media;
}
```

## Complete Example

Here is a complete example showing various DCO patterns:

```ts
import { webRequest } from 'common/web-request.js';
import { Media, QueryOptions } from 'shared/entities.js';
import { BaseDco, dcoHub } from './dco-base.js';

class MediaDao extends BaseDco<Media, QueryOptions<Media>> {
  constructor() {
    super('Media');
  }

  // Override create for file upload support
  async create(props: any & { file?: File }): Promise<Media> {
    const file = props.file;

    if (file) {
      const formData = new FormData();
      formData.append('file', file);

      const webResult = await webRequest('POST', '/api/dse/Media', {
        body: formData
      });

      const media = webResult.success ? webResult.data as Media : null;

      if (media == null) {
        throw new Error(`Could not create media for ${file.name}`);
      }

      dcoHub.pub(this._entityType, 'create', media);
      return media;

    } else {
      return super.create(props);
    }
  }

  // Convenience methods for common queries
  async listImages(): Promise<Media[]> {
    return super.list({ filters: { type: 'image' } });
  }

  async listVideos(): Promise<Media[]> {
    return super.list({ filters: { type: 'video' } });
  }

  // Custom method for batch operations
  async updateMultiple(ids: number[], props: Partial<Media>): Promise<Media[]> {
    const results = await Promise.all(
      ids.map(id => this.update(id, props))
    );
    return results;
  }
}

export const mediaDco = new MediaDao();
```

## Best Practices

1. **Use simple DCOs for basic entities** - If you only need standard CRUD, use `new BaseDco<Type, Filter>('EntityName')` directly.

2. **Extend for special behavior** - Create a class only when you need to override methods or add custom functionality.

3. **Always publish events** - When overriding data modification methods, publish events using `dcoHub.pub()`.

4. **Use convenience methods** - Add methods like `listImages()` for commonly used queries to improve code readability.

5. **Handle errors appropriately** - Either throw the web result or a custom error with meaningful context.

6. **Type safety** - Always specify the entity type and filter type when extending `BaseDco`.

7. **Entity name consistency** - The entity name string passed to `super()` must match the server-side entity name exactly.

8. **Import from shared** - Entity types and query options should be imported from `shared/entities.js`.

9. **Use super for default behavior** - When overriding methods, call `super.method()` for the default case when appropriate.

10. **Keep DCOs focused** - DCOs should only handle data fetching and modification. Business logic belongs in views or services.
