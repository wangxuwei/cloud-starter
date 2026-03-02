# DAO Best Practices

This document provides guidance on creating Data Access Object (DAO) methods with entities in this codebase.

## Table of Contents

- [Overview](#overview)
- [Basic DAO Structure](#basic-dao-structure)
- [Extending BaseDao](#extending-basedao)
- [Extending OrgScopedDao](#extending-orgscopeddao)
- [Access Control](#access-control)
- [Entity Processing](#entity-processing)
- [Include Processing](#include-processing)
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
| `allColumns` | `string[]` | All available columns for include validation |

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

## Include Processing

Override `getIncludeProcessorOptions` and `getRelatedDao` to enable nested entity queries through the `$includes` parameter.

### getIncludeProcessorOptions

Define column groups and relationships for nested entity queries.

```typescript
import { RelationshipConfig } from '#shared/query_options.js';
import { IncludeProcessorOptions } from './include-utils.js';
import { OrgScopedDao } from './dao-org-scoped.js';

export class ProjectDao extends OrgScopedDao<Project, number> {
  //#region    ---------- Include Processor Options ---------- 
  protected getIncludeProcessorOptions(): IncludeProcessorOptions {
    const baseOptions = super.getIncludeProcessorOptions();
    return {
      ...baseOptions,
      columnGroups: {
        ...baseOptions.columnGroups,
        // Custom column groups
        _projectInfo: ['id', 'name', 'wksId'],
        _details: ['id', 'name']
      },
      relationships: {
        workspace: {
          type: 'belongsTo',
          targetTable: 'wks',
          foreignKey: 'wksId',
          targetKey: 'id',
          as: 'w',
          targetColumns: ['id', 'name'],
          targetColumnGroups: {
            _defaults: ['id', 'name']
          },
          targetStamped: true,
          includes: {} // Empty object means use default columns from targetColumns
        } as RelationshipConfig
      }
    };
  }
  
  protected getRelatedDao(relation: string) {
    if (relation === 'workspace') {
      return wksDao;
    }
    return null;
  }
  //#endregion ---------- /Include Processor Options ---------- 
}
```

### Relationship Configuration

Relationships can be of three types: `belongsTo`, `hasMany`, or `hasOne`.

#### belongsTo Example

```typescript
relationships: {
  workspace: {
    type: 'belongsTo',           // Many-to-one: this entity belongs to workspace
    targetTable: 'wks',          // Target table name
    foreignKey: 'wksId',          // FK on this table pointing to target
    targetKey: 'id',              // PK on target table (defaults to 'id')
    as: 'w',                      // Table alias for JOIN
    targetColumns: ['id', 'name'], // Default columns to select from target
    targetColumnGroups: {         // Column groups for target entity
      _defaults: ['id', 'name']
    },
    targetStamped: true,          // Does target have audit columns?
    includes: {}                  // Include spec for default columns (empty object = use defaults)
  }
}
```

#### hasMany Example

```typescript
relationships: {
  project: {
    type: 'hasMany',              // One-to-many: this entity has many projects
    targetTable: 'project',       // Target table name
    foreignKey: 'wksId',          // FK on target table pointing to this entity
    targetKey: 'id',              // PK on target table (defaults to 'id')
    as: 'p',                      // Table alias for queries
    targetColumns: ['id', 'name'], // Default columns to select from target
    targetColumnGroups: {         // Column groups for target entity
      _defaults: ['id', 'name']
    },
    targetStamped: true,          // Does target have audit columns?
    includes: {}                  // Include spec for default columns (empty object = use defaults)
  }
}
```

#### hasOne Example

```typescript
relationships: {
  profile: {
    type: 'hasOne',               // One-to-one: this entity has one profile
    targetTable: 'profile',       // Target table name
    foreignKey: 'userId',         // FK on target table pointing to this entity
    targetKey: 'id',              // PK on target table (defaults to 'id')
    as: 'profile',                // Table alias for queries
    targetColumns: ['id', 'bio'], // Default columns to select from target
    targetColumnGroups: {         // Column groups for target entity
      _defaults: ['id', 'bio']
    },
    targetStamped: true,          // Does target have audit columns?
    includes: {}                  // Include spec for default columns (empty object = use defaults)
  }
}
```

### Using Includes in Queries

```typescript
// Include related workspace entity
const projects = await projectDao.list(utx, {
  includes: {
    workspace: true  // Include workspace with default columns
  }
});

// Include specific columns
const projects = await projectDao.list(utx, {
  includes: {
    workspace: { id: true, name: true }
  }
});

// Use column groups
const projects = await projectDao.list(utx, {
  includes: {
    workspace: { _defaults: true, _timestamps: true }
  }
});

// Nested includes
const workspaces = await wksDao.list(utx, {
  includes: {
    project: {
      _defaults: true,
      // Note: For hasMany, nested includes are batch-loaded
    }
  }
});
```

### Relationship Type Behavior

- **belongsTo**: Creates SQL LEFT JOIN, data is included in main query result
- **hasMany**: Batch-loaded with separate query to avoid N+1 problem
- **hasOne**: Batch-loaded with separate query to avoid N+1 problem

### Include Specification in Relationship Config

When defining relationships in `getIncludeProcessorOptions`, the `includes` property in the `RelationshipConfig` specifies the default column selection for that relationship:

- **`includes: {}`** (empty object): Use default columns from `targetColumns`. This is recommended for most cases.
- **`includes: true`**: Same as empty object, use default columns.
- **`includes: { id: true, name: true }`**: Select specific columns.
- **`includes: { _defaults: true }`**: Select columns from the `_defaults` column group.

The `includes` property in the relationship config provides the default behavior when the relationship is included without specifying columns. When querying, you can override this default by specifying your own include specification.

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

### 11. Configure Include Processor Options

When defining relationships in `getIncludeProcessorOptions`, ensure:

- Use lowercase relationship keys to match entity property names
- Define `targetColumns` for default column selection in related entities
- Define `targetColumnGroups` for convenient column group access
- Set `targetStamped` appropriately based on whether target entity has audit columns
- Provide `as` alias for belongsTo relationships to avoid SQL conflicts
- Implement `getRelatedDao` to return the correct DAO for each relationship
- Add `includes: {}` to relationship configuration to specify default column selection behavior

```typescript
protected getRelatedDao(relation: string) {
  if (relation === 'workspace') {
    return wksDao;
  }
  if (relation === 'project') {
    return projectDao;
  }
  return null;
}
```

### 12. Include Validation

The `validateIncludes` function automatically validates:
- Include keys match available columns, column groups, or relationships
- Relationship configurations are valid (have required properties)
- Nested include specifications are recursively validated

Invalid includes will throw an error with helpful context about available keys. Empty objects `{}` are valid for relationship includes and mean "use default columns."

## Complete Example

Here's a complete example combining all best practices:

```typescript
import { QueryOptions } from '#shared/entities.js';
import { Ticket } from '#shared/entities/ticket-entity.js';
import { RelationshipConfig } from '#shared/query_options.js';
import { IncludeProcessorOptions } from './include-utils.js';
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
      orderBy: '!ctime',
      allColumns: TICKET_COLUMNS
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

  //#region    ---------- Include Processor Options ---------- 
  protected getIncludeProcessorOptions(): IncludeProcessorOptions {
    const baseOptions = super.getIncludeProcessorOptions();
    return {
      ...baseOptions,
      columnGroups: {
        ...baseOptions.columnGroups,
        _ticketInfo: ['id', 'title', 'status'],
        _details: ['id', 'title']
      },
      relationships: {
        project: {
          type: 'belongsTo',
          targetTable: 'project',
          foreignKey: 'projectId',
          targetKey: 'id',
          as: 'p',
          targetColumns: ['id', 'name'],
          targetColumnGroups: {
            _defaults: ['id', 'name']
          },
          targetStamped: true,
          includes: {} // Empty object means use default columns from targetColumns
        } as RelationshipConfig
      }
    };
  }

  protected getRelatedDao(relation: string) {
    if (relation === 'project') {
      return projectDao;
    }
    return null;
  }
  //#endregion ---------- /Include Processor Options ---------- 
}
```
