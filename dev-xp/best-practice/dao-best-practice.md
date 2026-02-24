# DAO Best Practices

This document provides guidance on creating Data Access Object (DAO) methods with entities in this codebase.

## Table of Contents

- [Overview](#overview)
- [Basic DAO Structure](#basic-dao-structure)
- [Extending BaseDao](#extending-basedao)
- [Extending OrgScopedDao](#extending-orgscopeddao)
- [Access Control](#access-control)
- [Entity Processing](#entity-processing)
- [Custom Methods](#custom-methods)
- [Query Options](#query-options)
- [Best Practices](#best-practices)

## Overview

The DAO layer provides database access with built-in access control, monitoring, and organization scoping. All DAOs extend from either `BaseDao` or `OrgScopedDao`.

The base classes are located in:
- `services/_common/src/da/dao-base.ts`
- `services/_common/src/da/dao-org-scoped.ts`

## Basic DAO Structure

All DAOs follow a consistent pattern:

```typescript
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { BaseDao } from './dao-base.js';

export class ExampleDao extends BaseDao<Entity, number> {
  constructor() {
    super({ 
      table: 'table_name', 
      stamped: true,        // Whether to auto-set cid, ctime, mid, mtime
      orderBy: 'name',       // Default sort order (prefix with ! for DESC)
      columns: ['id', 'name'] // Fixed columns for get/first/list
    });
  }
}
```

### Constructor Options

| Option | Type | Description |
|--------|------|-------------|
| `table` | `string` | The database table name |
| `stamped` | `boolean` | Whether to auto-set audit fields (cid, ctime, mid, mtime) |
| `idNames` | `string \| string[]` | Primary key name(s). Defaults to `'id'` |
| `orderBy` | `string \| null` | Default sort order. Prefix with `!` for DESC |
| `columns` | `string[]` | Fixed columns to select in get/first/list operations |

## Extending BaseDao

`BaseDao` is suitable for entities that are not organization-scoped. Example:

```typescript
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { BaseDao } from './dao-base.js';

export class OAuthDao extends BaseDao<OAuth, number>{
  constructor() {
    super({ table: 'oauth', stamped: true });
  }

  @AccessRequires()
  async create(utx: UserContext, data: Partial<OAuth>) {
    return super.create(utx, data);
  }

  @AccessRequires()
  async update(utx: UserContext, id: number, data: Partial<OAuth>) {
    return super.update(utx, id, data);
  }
}
```

## Extending OrgScopedDao

`OrgScopedDao` is suitable for entities that belong to an organization. It automatically:
- Ensures `utx.orgId` is present
- Scopes queries to the organization
- Validates orgId consistency in data

```typescript
import { QueryOptions } from '#shared/entities.js';
import { Project } from '#shared/entities/project-entity.js';
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { OrgScopedDao } from './dao-org-scoped.js';

export const PROJECT_COLUMNS = Object.freeze(['id', 'cid', 'ctime', 'mid', 'mtime', 'name', "wksId"] as const);

export class ProjectDao extends OrgScopedDao<Project, number> {
  constructor() { super({ table: 'project', stamped: true }) }
  
  @AccessRequires('a_admin', 'org_a_project_manage')
  async get(utx: UserContext, id: number) {
    return super.get(utx, id);
  }

  @AccessRequires('#user')
  async create(utx: UserContext, data: Partial<Project>) {
    return super.create(utx, data);
  }

  @AccessRequires('a_admin', 'org_a_project_manage')
  async update(utx: UserContext, id: number, data: Partial<Project>) {
    return super.update(utx, id, data);
  }

  @AccessRequires('a_admin', 'org_a_project_manage')
  async remove(utx: UserContext, ids: number | number[]) {
    return super.remove(utx, ids);
  }
}
```

## Access Control

The `@AccessRequires()` decorator controls method access. Multiple access levels can be specified; passing any one grants access.

### Access Types

1. **Global Access**: e.g., `'a_admin'`, `'#user'`
2. **Org Access**: e.g., `'org_a_content_view'`, `'org_a_project_manage'`
3. **Entity Match**: e.g., `'@id'`, `'@cid'`, `'@userId'`

### Access Decorator Patterns

```typescript
// Only system access (default for BaseDao methods)
@AccessRequires()
async get(utx: UserContext, id: number) {
  return super.get(utx, id);
}

// Any of the specified accesses
@AccessRequires('a_admin', 'org_a_project_manage')
async get(utx: UserContext, id: number) {
  return super.get(utx, id);
}

// Requires global admin OR project management access
@AccessRequires('a_admin', 'org_a_project_manage')
async list(utx: UserContext, queryOptions?: QueryOptions<Project>) {
  return super.list(utx, queryOptions);
}

// Requires update access AND userId must match cid field
@AccessRequires('a_admin_edit_user', '@id')
async update(utx: UserContext, id: number, data: Partial<User>) {
  return super.update(utx, id, data);
}
```

### Special Entity Match Access

Entity match access compares the user's ID with a property of the entity:

- `'@id'` - Match `utx.userId` with `entity.id`
- `'@cid'` - Match `utx.userId` with `entity.cid` (creator)
- `'@userId'` - Match `utx.userId` with `entity.userId`

## Entity Processing

Override these methods to transform data between the database and your entities.

### parseRecord

Transform database rows into entities. Called for each row returned.

```typescript
import { CORE_STORE_CDN_BASE_URL, CORE_STORE_ROOT_DIR } from '../conf.js';
import { Media } from '#shared/entities.js';

export class MediaDao extends OrgScopedDao<Media, number> {
  constructor() { super({ table: 'media', stamped: true }) }

  parseRecord(dbRec: any): Media {
    dbRec.url = `${CORE_STORE_CDN_BASE_URL}${CORE_STORE_ROOT_DIR}${dbRec.folderPath}${dbRec.name ?? dbRec.srcName}`;
    if (dbRec.sd) {
      dbRec.sdUrl = `${CORE_STORE_CDN_BASE_URL}${CORE_STORE_ROOT_DIR}${dbRec.folderPath}${getResMp4Name(dbRec.name, dbRec.sd)}`;
    }
    return dbRec as Media;
  }
}
```

### serializeEntity

Transform entities into database records before save.

```typescript
protected serializeEntity(entity: E): any {
  return entity;
}
```

### cleanForSave

Remove properties that should not be saved (e.g., computed properties).

```typescript
protected cleanForSave(utx: UserContext, data: Partial<E>, forCreate = false): Partial<E> {
  removeProps(data, ['cid', 'ctime', 'mid', 'mtime']);
  return data;
}
```

## Custom Methods

Add domain-specific methods beyond standard CRUD operations.

```typescript
import { Org, User } from '#shared/entities.js';
import { knexQuery } from './db.js';

export class OrgDao extends BaseDao<Org, number> {
  constructor() { super({ table: 'org', stamped: true }) }

  @AccessRequires('a_admin', 'org_a_user_assign_admin')
  async getOwners(utx: UserContext, orgId: number): Promise<User[]> {
    const { query } = await knexQuery({ utx, tableName: 'user' });

    const r: any[] = await query.column('user.*')
      .rightJoin('user_org', 'user.id', 'user_org.userId')
      .where({ orgId, 'user_org.name': 'owner' });

    r.forEach(user => { delete user.pwd });
    return r;
  }
}
```

## Query Options

Use query options to filter, sort, and paginate results.

```typescript
import { QueryOptions } from '#shared/entities.js';

// Simple filters
const result = await dao.list(utx, {
	filters: { status: 'active' }
});

// With filters and sorting
const result = await dao.list(utx, {
	filters: [{ type: 'image' }, { status: 'active' }],
	list_options: {
		order_bys: ['!ctime'] // DESC by ctime
		limit: 10,
		offset: 20
	}
});

// With operators (MongoDB-style)
const result = await dao.list(utx, {
	filters: { 
		age: { $gte: 18 },
		name: { $startsWith: 'John' }
	}
});
```

### Custom Query

```typescript
import { Knex } from 'knex';

const result = await dao.list(utx, {
	custom: (query: Knex.QueryBuilder) => {
		query.whereRaw('LOWER(name) = ?', ['john']);
	}
});
```

### Custom Query

```typescript
import { Knex } from 'knex';

const result = await dao.list(utx, {
  custom: (query: Knex.QueryBuilder) => {
    query.whereRaw('LOWER(name) = ?', ['john']);
  }
});
```

## Best Practices

### 1. Always Define Access Requirements

Every public method should have `@AccessRequires()`:

```typescript
@AccessRequires('a_admin', 'org_a_project_manage')
async get(utx: UserContext, id: number) {
  return super.get(utx, id);
}
```

### 2. Use Frozen Column Constants

Define columns that should be selected as frozen constants:

```typescript
export const PROJECT_COLUMNS = Object.freeze([
  'id', 'cid', 'ctime', 'mid', 'mtime', 'name', 'wksId'
] as const);
```

### 3. Monitor Performance

Add `@Monitor()` to performance-critical methods:

```typescript
import { Monitor } from '../perf.js';

@Monitor()
@AccessRequires('a_admin', 'org_a_content_view')
async list(utx: UserContext, queryOptions?: OrgQueryOptions): Promise<Org[]> {
  return super.list(utx, queryOptions);
}
```

### 4. Override Base Methods Appropriately

When overriding base methods, call `super` after access control checks:

```typescript
@AccessRequires('a_admin', 'org_a_project_manage')
async update(utx: UserContext, id: number, data: Partial<Project>) {
  return super.update(utx, id, data);
}
```

### 5. Handle Organization Scoping Consistently

For org-scoped entities, extend `OrgScopedDao` and let it handle scoping:

```typescript
export class ProjectDao extends OrgScopedDao<Project, number> {
  // Automatic org scoping in all methods
}
```

### 6. Use Proper Type Guards

Define interfaces for special query options or return types:

```typescript
import { QueryOptions } from '#shared/entities.js';
import { Org, OrgAccess } from '#shared/entities.js';

export interface OrgQueryOptions extends QueryOptions<Org> {
  access: OrgAccess
}
```

### 7. Validate Data in Custom Methods

Add validation for critical data:

```typescript
async createWithFile(utx: UserContext, data: Partial<Media> & { file: File }): Promise<number> {
  const orgId = utx.orgId;

  if (orgId == null) {
    throw new Err(ERROR.MEDIA_UPLOAD_FAIL_NO_ORGID);
  }

  // ... rest of implementation
}
```

### 8. Clean Security Data

For entities with sensitive fields (passwords, salts), ensure they are removed:

```typescript
parseRecord(user: User) {
  for (const col of USER_SECURITY_COLUMNS) {
    if ((<any>user)[col] !== undefined) {
      delete (<any>user)[col];
    }
  }
  return user;
}
```

### 9. Export DAO Instances

Export singleton instances from a central `daos.ts` file:

```typescript
export const userDao = new UserDao();
export const orgDao = new OrgDao();
export const projectDao = new ProjectDao();
export const mediaDao = new MediaDao();
```

### 10. Use Knex Query for Custom SQL

When you need custom queries, use `knexQuery()`:

```typescript
import { knexQuery } from './db.js';

const { query } = await knexQuery({ utx, tableName: 'some_table' });
const result = await query
  .leftJoin('other_table', 'some_table.id', 'other_table.someId')
  .where({ 'some_table.status': 'active' });
```

## Complete Example

Here's a complete example combining all best practices:

```typescript
import { QueryOptions } from '#shared/entities.js';
import { Ticket } from '#shared/entities/ticket-entity.js';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { AccessRequires } from './access.js';
import { OrgScopedDao } from './dao-org-scoped.js';

export const TICKET_COLUMNS = Object.freeze([
  'id', 'cid', 'ctime', 'mid', 'mtime', 
  'title', 'status', 'priority', 'projectId'
] as const);

export class TicketDao extends OrgScopedDao<Ticket, number> {
  constructor() { 
    super({ 
      table: 'ticket', 
      stamped: true,
      orderBy: '!ctime'
    }) 
  }

  @AccessRequires('a_admin', 'org_a_ticket_view')
  async get(utx: UserContext, id: number) {
    return super.get(utx, id);
  }

  @AccessRequires('a_admin', 'org_a_ticket_view')
  @Monitor()
  async list(utx: UserContext, queryOptions?: QueryOptions<Ticket>): Promise<Ticket[]> {
    return super.list(utx, queryOptions);
  }

  @AccessRequires('a_admin', 'org_a_ticket_create')
  @Monitor()
  async create(utx: UserContext, data: Partial<Ticket>) {
    return super.create(utx, data);
  }

  @AccessRequires('a_admin', 'org_a_ticket_edit', '@cid')
  async update(utx: UserContext, id: number, data: Partial<Ticket>) {
    return super.update(utx, id, data);
  }

  @AccessRequires('a_admin', 'org_a_ticket_delete')
  async remove(utx: UserContext, ids: number | number[]) {
    return super.remove(utx, ids);
  }

  @AccessRequires('a_admin', 'org_a_ticket_view')
  async getByProject(utx: UserContext, projectId: number): Promise<Ticket[]> {
    return this.list(utx, { filters: { projectId } });
  }
}
```
