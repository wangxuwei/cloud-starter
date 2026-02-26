# JOQL Query Options Specification

This document provides a comprehensive specification for JOQL (Json Oriented Query Language) query options, including `$include` and `$filter` parameters. These options are used in query methods like `*_list` and `*_first` to control what data is returned and how it's filtered.

## Table of Contents

- [Overview](#overview)
- [$includes Parameter](#includes-parameter)
- [$filters Parameter](#filters-parameter)
- [Query Performance Best Practices](#query-performance-best-practices)
- [DAO Configuration](#dao-configuration)
- [Examples](#examples)

## Overview

JOQL query options are passed as parameters to query methods in JSON-RPC 2.0 format. The main query options are:

- `$includes`: Control which properties and related entities are returned
- `$filters`: Filter the result set based on conditions
- `$orderBy`: Order the results
- `$limit`: Limit the number of results
- `$offset`: Skip results for pagination

```json
{
  "jsonrpc": "2.0",
  "method": "project_list",
  "params": {
    "$filters": { "status": "active" },
    "$includes": { "id": true, "name": true, "tickets": { "_defaults": true } },
    "$orderBy": "!ctime",
    "$limit": 10
  },
  "id": null
}
```

## $includes Parameter

The `$includes` parameter controls which properties and related entities are returned in the query response. This enables clients to request exactly the data they need, reducing bandwidth and improving performance.

### Basic Property Includes

Include specific properties by setting them to `true`:

```json
{
  "$includes": {
    "id": true,
    "name": true,
    "description": true
  }
}
```

### Group Includes

Keys starting with `_` represent property groups defined in the DAO:

- `_defaults`: Default properties for the entity (e.g., `id`, `name`)
- `_timestamps`: Audit fields (`cid`, `ctime`, `mid`, `mtime`)
- `_stamped`: Combination of defaults and timestamps
- Custom groups: Defined per DAO (e.g., `_projectInfo`, `_details`)

```json
{
  "$includes": {
    "_defaults": true,
    "_timestamps": true,
    "_details": true
  }
}
```

### Nested Entity Includes

Include related entities by specifying the relationship name as a key with a nested include specification:

```json
{
  "$includes": {
    "_defaults": true,
    "project": {
      "_defaults": true,
      "name": true,
      "workspace": {
        "_defaults": true
      }
    },
    "assignee": {
      "_defaults": true,
      "email": true
    }
  }
}
```

### Relationship Types

The system supports three relationship types, each handled differently for optimal performance:

#### belongsTo

For relationships where the source entity references a single target entity (e.g., ticket belongs to project). These are loaded using SQL LEFT JOINs in a single query.

```json
{
  "$includes": {
    "project": { "_defaults": true }
  }
}
```

This generates SQL similar to:
```sql
SELECT ticket.id, ticket.title, project.id AS "project.id", project.name AS "project.name"
FROM ticket
LEFT JOIN project ON ticket.projectId = project.id
```

#### hasMany

For relationships where the source entity has multiple related entities (e.g., project has many tickets). These are loaded using batch queries to avoid N+1 problems and data duplication.

```json
{
  "$includes": {
    "_defaults": true,
    "tickets": {
      "_defaults": true,
      "status": true
    }
  }
}
```

This generates two queries:
1. Main query: `SELECT id, name FROM project WHERE ...`
2. Batch query: `SELECT id, title, status FROM ticket WHERE projectId IN (1, 2, 3, ...)`

The results are then assembled in-memory to produce the nested structure.

#### hasOne

Similar to `hasMany` but returns at most one related entity. Also uses batch loading for performance.

```json
{
  "$includes": {
    "profile": { "_defaults": true }
  }
}
```

### Deep Nesting

The system supports arbitrary nesting depth for includes. Each level can specify which properties to include.

```json
{
  "$includes": {
    "_defaults": true,
    "tickets": {
      "_defaults": true,
      "comments": {
        "_defaults": true,
        "author": {
          "_defaults": true,
          "email": true
        }
      }
    }
  }
}
```

This generates optimized queries:
- Main query: Projects
- Batch query: Tickets for the projects
- Batch query: Comments for all tickets
- Batch query: Authors for all comments

### Column Aliasing

When including nested entities, columns are automatically namespaced to prevent conflicts:

```json
{
  "$includes": {
    "id": true,
    "project": { "id": true, "name": true }
  }
}
```

Response format:
```json
{
  "id": 1,
  "title": "Ticket 1",
  "project": {
    "id": 10,
    "name": "Project Alpha"
  }
}
```

The SQL uses aliasing: `project.id AS "project.id"`

### Explicit Exclusions

Properties can be explicitly excluded by setting them to `false`:

```json
{
  "$includes": {
    "_defaults": true,
    "internalField": false
  }
}
```

## $filters Parameter

The `$filters` parameter allows filtering the result set based on conditions. Filters use conditional operators to express complex queries.

### Filter Operators

#### Equality Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `$eq` | Exact match (default operator) | `{ "name": { "$eq": "John" } }` or `{ "name": "John" }` |
| `$in` | Match any value in array (OR) | `{ "status": { "$in": ["active", "pending"] } }` |
| `$not` | Exclude exact match | `{ "status": { "$not": "deleted" } }` |
| `$notIn` | Exclude any in array | `{ "status": { "$notIn": ["deleted", "archived"] } }` |

#### String Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `$contains` | String contains substring | `{ "name": { "$contains": "John" } }` |
| `$containsAny` | Contains any of the strings | `{ "tags": { "$containsAny": ["important", "urgent"] } }` |
| `$containsAll` | Contains all of the strings | `{ "tags": { "$containsAll": ["bug", "high-priority"] } }` |
| `$notContains` | Does not contain substring | `{ "name": { "$notContains": "test" } }` |
| `$notContainsAny` | Does not contain any of the strings | `{ "tags": { "$notContainsAny": ["spam", "ad"] } }` |
| `$startsWith` | String starts with prefix | `{ "name": { "$startsWith": "Admin" } }` |
| `$startsWithAny` | Starts with any of the prefixes | `{ "username": { "$startsWithAny": ["admin", "mod"] } }` |
| `$notStartsWith` | Does not start with prefix | `{ "name": { "$notStartsWith": "Test" } }` |
| `$notStartsWithAny` | Does not start with any of the prefixes | `{ "username": { "$notStartsWithAny": ["guest", "temp"] } }` |
| `$endsWith` | String ends with suffix | `{ "email": { "$endsWith": "@example.com" } }` |
| `$endsWithAny` | Ends with any of the suffixes | `{ "email": { "$endsWithAny": ["@example.com", "@test.com"] } }` |
| `$notEndsWith` | Does not end with suffix | `{ "email": { "$notEndsWith": "@spam.com" } }` |
| `$notEndsWithAny` | Does not end with any of the suffixes | `{ "email": { "$notEndsWithAny": ["@spam.com", "@junk.com"] } }` |

#### Comparison Operators

| Operator | Meaning | Example |
|----------|---------|---------|
| `$lt` | Less than | `{ "priority": { "$lt": 5 } }` |
| `$lte` | Less than or equal | `{ "priority": { "$lte": 5 } }` |
| `$gt` | Greater than | `{ "priority": { "$gt": 3 } }` |
| `$gte` | Greater than or equal | `{ "priority": { "$gte": 3 } }` |

#### Null Check Operator

| Operator | Meaning | Example |
|----------|---------|---------|
| `$null` | Check if value is null | `{ "deletedAt": { "$null": true } }` |

### Multiple Filters

When multiple filter objects are provided, they are combined with OR logic:

```json
{
  "$filters": [
    { "status": "active" },
    { "status": "pending" }
  ]
}
```

This is equivalent to: `status = 'active' OR status = 'pending'`

Multiple operators on the same field are ANDed together:

```json
{
  "$filters": {
    "priority": { "$gte": 3, "$lte": 5 },
    "status": "active"
  }
}
```

This is equivalent to: `priority >= 3 AND priority <= 5 AND status = 'active'`

### Type-Specific Examples

#### String Filters

```json
{
  "$filters": {
    "name": "John Doe",
    "email": { "$contains": "@example.com" }
  }
}
```

#### Number Filters

```json
{
  "$filters": {
    "priority": { "$gte": 3, "$lt": 5 },
    "assigneeId": { "$in": [1, 2, 3] }
  }
}
```

#### Boolean Filters

```json
{
  "$filters": {
    "isDeleted": false,
    "isArchived": { "$eq": true }
  }
}
```

#### Array/String Array Filters

```json
{
  "$filters": {
    "tags": "bug",
    "labels": { "$has": ["bug", "high-priority"] }
  }
}
```

## Query Performance Best Practices

### Minimize Data Transfer

Only request the fields you need:

**Good:**
```json
{
  "$includes": {
    "id": true,
    "name": true
  }
}
```

**Avoid:**
```json
{
  "$includes": {
    "_defaults": true,
    "description": true,
    "allDetails": true
  }
}
```

### Use Pagination

Always use `$limit` for large datasets:

```json
{
  "$limit": 50,
  "$offset": 0
}
```

### Index-Friendly Filters

Design filters to use database indexes:

```json
{
  "$filters": {
    "status": "active",
    "priority": { "$gte": 3 }
  }
}
```

Avoid leading wildcards in string operations:

```json
{
  "$filters": {
    "name": { "$startsWith": "Admin" }
  }
}
```

### Batch Loading Benefits

The system automatically uses batch loading for `hasMany` and `hasOne` relationships, avoiding N+1 queries:

```json
{
  "$includes": {
    "tickets": { "_defaults": true }
  }
}
```

This generates:
1. One query for projects
2. One query for all tickets (with `WHERE projectId IN (...)`)

Not N queries (one per project).

### Prefer belongsTo for Single Relations

Use `belongsTo` relationships for single related entities to leverage SQL JOINs:

```json
{
  "$includes": {
    "project": { "_defaults": true },
    "assignee": { "_defaults": true }
  }
}
```

This generates a single query with LEFT JOINs, minimizing round-trips.

### Shallow Nesting

Prefer shallower nesting when possible. Deep nesting requires more queries:

```json
{
  "$includes": {
    "project": { "_defaults": true }
  }
}
```

Is more efficient than:
```json
{
  "$includes": {
    "project": {
      "workspace": {
        "owner": {
          "org": {
            "_defaults": true
          }
        }
      }
    }
  }
}
```

### Filter Early

Apply filters in `$filters` rather than filtering client-side:

```json
{
  "$filters": {
    "status": "open"
  }
}
```

This allows the database to optimize the query and reduce data transfer.

## DAO Configuration

### Defining Column Groups

Column groups are defined in the DAO constructor via `columnGroups`:

```typescript
class ProjectDao extends OrgScopedDao<Project, number> {
  constructor() {
    super({
      table: 'project',
      stamped: true,
      columns: PROJECT_COLUMNS
    });
  }

  protected getIncludeProcessorOptions() {
    const baseOptions = super.getIncludeProcessorOptions();
    return {
      ...baseOptions,
      columnGroups: {
        ...baseOptions.columnGroups,
        _projectInfo: ['id', 'name', 'wksId'],
        _details: ['id', 'name', 'description']
      }
    };
  }
}
```

### Defining Relationships

Relationships are configured in `getIncludeProcessorOptions()`:

```typescript
protected getIncludeProcessorOptions() {
  const baseOptions = super.getIncludeProcessorOptions();
  return {
    ...baseOptions,
    relationships: {
      project: {
        type: 'belongsTo',
        targetTable: 'project',
        foreignKey: 'projectId',
        targetKey: 'id',
        as: 'project',
        targetColumns: ['id', 'name', 'description'],
        targetColumnGroups: {
          _defaults: ['id', 'name']
        },
        targetStamped: true
      },
      assignee: {
        type: 'belongsTo',
        targetTable: 'user',
        foreignKey: 'assigneeId',
        targetKey: 'id',
        as: 'assignee',
        targetColumns: ['id', 'username', 'fullName', 'email'],
        targetStamped: false
      }
    }
  };
}
```

### Implementing getRelatedDao

Override `getRelatedDao()` to map relationship names to DAO instances:

```typescript
protected getRelatedDao(relation: string): BaseDao<any, any> | null {
  if (relation === 'project') return projectDao;
  if (relation === 'assignee') return userDao;
  return null;
}
```

### Hidden Columns

Define hidden columns to prevent security-sensitive fields from being returned:

```typescript
class UserDao extends OrgScopedDao<User, number> {
  protected hiddenColumns = ['pwd', 'salt', 'resetToken'];

  protected getIncludeProcessorOptions() {
    const baseOptions = super.getIncludeProcessorOptions();
    return {
      ...baseOptions,
      hiddenColumns: this.hiddenColumns
    };
  }
}
```

Hidden columns are filtered at the SQL generation level before any query execution, ensuring they are never returned even if explicitly requested.

## Examples

### Simple Project List

```json
{
  "jsonrpc": "2.0",
  "method": "project_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "description": true
    },
    "$filters": {
      "status": "active"
    },
    "$orderBy": "name",
    "$limit": 20
  },
  "id": null
}
```

### Tickets with Project and Assignee

```json
{
  "jsonrpc": "2.0",
  "method": "ticket_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "title": true,
      "status": true,
      "project": {
        "_defaults": true,
        "name": true
      },
      "assignee": {
        "_defaults": true,
        "fullName": true
      }
    },
    "$filters": {
      "status": "open",
      "priority": { "$gte": 3 }
    },
    "$orderBy": "!ctime"
  },
  "id": null
}
```

### Deep Nesting with Multiple Relationships

```json
{
  "jsonrpc": "2.0",
  "method": "workspace_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "projects": {
        "_defaults": true,
        "tickets": {
          "_defaults": true,
          "comments": {
            "_defaults": true,
            "author": {
              "_defaults": true,
              "email": true
            }
          }
        }
      }
    },
    "$filters": {
      "orgId": 123
    },
    "$limit": 10
  },
  "id": null
}
```

### Complex Filters

```json
{
  "jsonrpc": "2.0",
  "method": "ticket_list",
  "params": {
    "$includes": {
      "_defaults": true
    },
    "$filters": {
      "status": { "$in": ["open", "in-progress"] },
      "priority": { "$gte": 3 },
      "title": { "$contains": "urgent" },
      "deletedAt": { "$null": true }
    }
  },
  "id": null
}
```

### Using Column Groups

```json
{
  "jsonrpc": "2.0",
  "method": "project_list",
  "params": {
    "$includes": {
      "_projectInfo": true,
      "workspace": {
        "_defaults": true
      }
    },
    "$limit": 50
  },
  "id": null
}
```

## Type Definitions

Reference TypeScript type definitions for query options:

```typescript
export type IncludeSpec = boolean | IncludeObject;

export interface IncludeObject {
  [key: string]: IncludeSpec;
}

export type RelationshipType = 'belongsTo' | 'hasMany' | 'hasOne';

export interface RelationshipConfig {
  type: RelationshipType;
  targetTable: string;
  foreignKey: string;
  targetKey?: string;
  as?: string;
  targetColumns?: string[];
  targetColumnGroups?: Record<string, string[]>;
  targetStamped?: boolean;
}

export interface QueryOptions<E> {
  filters?: QueryFilter<E>[] | QueryFilter<E>;
  includes?: IncludeObject;
  list_options?: ListOptions;
}

export type QueryFilter<E> = {
  [C in keyof E]?: { [op: Op]: Val | Val[] } | Val;
};

export interface ListOptions {
  limit?: number;
  offset?: number;
  order_bys?: string[];
}
```

## References

- JOQL Specification: `.aipack/spec.md`
- Entity Best Practices: `dev-xp/best-practice/entity-best-practice.md`
- Implementation Plan: `.aipack/.prompt/pro@coder/dev/chat/dev-chat.md`
