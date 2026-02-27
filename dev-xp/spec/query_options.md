# JOQL Query Options Specification

This document describes the QueryOptions and $includes functionality for JOQL (Json Oriented Query Language).

## Overview

JOQL provides a flexible query interface for filtering, including related entities, and paginating results. The `$includes` parameter controls what data is returned in query responses.

## QueryOptions Interface

```typescript
interface QueryOptions<E> {
  filters?: QueryFilter<E>[] | QueryFilter<E>;
  includes?: IncludeObject;
  list_options?: ListOptions;
}
```

## $includes Parameter

The `$includes` parameter controls which properties and related entities are returned in query responses.

### Basic Syntax

```json
{
  "$includes": {
    "propertyName": true,
    "_groupName": true,
    "relationName": {
      "nestedProperty": true
    }
  }
}
```

### Include Types

1. **Direct columns**: `{ "name": true }` - Include specific column
2. **Group includes**: `{ "_defaults": true }` - Include predefined column group
3. **Nested entities**: `{ "project": { "name": true } }` - Include related entity

### Empty Object for Default Columns

For nested entities, an empty object `{}` means "select default columns" for that entity. This is a shorthand for not having to specify `_defaults: true` explicitly.

```json
{
  "$includes": {
    "project": {}        // Same as { "project": { "_defaults": true } }
  }
}
```

### Result Structure

### BelongsTo Includes and Main Columns

When including `belongsTo` relationships, the main table's default columns are automatically included in the query selection. This is necessary to ensure proper data structure:

1. It allows the result parser to distinguish between columns from the main table and columns from the joined table (e.g., `main.id` vs `workspace.id`).
2. It prevents joined table columns from being incorrectly placed as top-level properties of the main entity.

Example behavior:
```json
{
  "$includes": {
    "workspace": {}
  }
}
```

Even though only `workspace` is included, the main table columns (like `id`, `name`) are automatically selected to provide context. The result correctly nests the workspace data:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Project 1",
      "workspace": {
        "id": 100,
        "name": "Workspace 1"
      }
    }
  ]
}
```

This behavior ensures that the returned structure always contains main table columns alongside the nested relationship data, regardless of whether main columns were explicitly requested.

## Relationship Types

### belongsTo (Many-to-One)

Foreign key on source table, loaded via LEFT JOIN.

```typescript
{
  type: 'belongsTo',
  targetTable: 'project',
  foreignKey: 'projectId',  // FK in source table
  targetKey: 'id',
  targetColumns: ['id', 'name'],
  targetStamped: true
}
```

**Query example:**
```json
{
  "$includes": {
    "project": {}
  }
}
```

**Result:**
```json
{
  "data": [
    {
      "id": 1,
      "title": "Ticket 1",
      "project": {
        "id": 1,
        "name": "Project 1"
      }
    }
  ]
}
```

### hasMany (One-to-Many)

Foreign key on target table, loaded via batch query.

```typescript
{
  type: 'hasMany',
  targetTable: 'ticket',
  foreignKey: 'projectId',  // FK in target table
  targetColumns: ['id', 'title']
}
```

### hasOne (One-to-One)

Foreign key on target table, loaded via batch query with single result.

```typescript
{
  type: 'hasOne',
  targetTable: 'profile',
  foreignKey: 'userId'
}
```

### Many-to-Many

Uses a junction/pivot table, loaded via batch query.

```typescript
{
  type: 'hasMany',
  targetTable: 'tag',
  foreignKey: 'tagId',           // FK in junction table referencing target
  junctionTable: 'project_tag',  // Junction/pivot table
  junctionSourceKey: 'projectId',  // FK in junction table referencing source
  junctionTargetKey: 'tagId'      // FK in junction table referencing target
}
```

**Important**: For many-to-many relationships:
- `foreignKey` refers to column in junction table that points to target table
- `junctionSourceKey` is column in junction table that points to source entity (defaults to source PK name)
- `junctionTargetKey` is column in junction table that points to target entity (defaults to `targetKey`)

## Column Groups

Predefined column groups for common patterns.

```typescript
{
  _defaults: ['id', 'name'],           // Default columns
  _timestamps: ['cid', 'ctime', 'mid', 'mtime'],  // Audit columns
  _stamped: ['id', 'name', 'cid', 'ctime', 'mid', 'mtime']  // All stamped columns
}
```

Custom groups can be defined in DAO configuration.

## $filters

The `$filters` parameter uses conditional operators to narrow down result set.

### Exact Match

```json
{
  "$filters": {
    "status": "open"
  }
}
```

### String Operators

- `$contains`: Contains substring
- `$startsWith`: Starts with
- `$endsWith`: Ends with
- `$notContains`, `$notStartsWith`, `$notEndsWith`: Negations
- `$containsAny`, `$startsWithAny`, `$endsWithAny`: Match any in array
- `$containsAll`: Contains all substrings in array
- `$notContainsAny`, `$notStartsWithAny`, `$notEndsWithAny`: None match

```json
{
  "$filters": {
    "title": { "$contains": "safari" },
    "name": { "$startsWith": "admin" }
  }
}
```

### Comparison Operators

- `$eq`: Equals (same as no operator)
- `$not`: Does not equal
- `$in`: In array
- `$notIn`: Not in array
- `$lt`: Less than
- `$lte`: Less than or equal
- `$gt`: Greater than
- `$gte`: Greater than or equal
- `$null`: Is null

```json
{
  "$filters": {
    "priority": { "$gt": 3 },
    "status": { "$in": ["open", "in-progress"] }
  }
}
```

## Pagination

### $limit

Limit the number of entities returned:

```json
{
  "$limit": 50
}
```

### $offset

Skip the first N entities:

```json
{
  "$offset": 100
}
```

### $orderBy

Order by a property. Prefix with `!` for descending order:

```json
{
  "$orderBy": "!ctime"
}
```

Multiple order by:

```json
{
  "$orderBy": ["!priority", "title"]
}
```

## Validation

The system validates include keys before SQL generation and throws descriptive errors:

```typescript
// Invalid column
{ "$includes": { "invalid_column": true } }
// Error: Invalid column 'invalid_column'. Available columns: id, name, description

// Invalid group
{ "$includes": { "_invalid_group": true } }
// Error: Invalid include group '_invalid_group'. Available groups: _defaults, _timestamps

// Invalid relationship
{ "$includes": { "invalid_relation": { "name": true } } }
// Error: Invalid include 'invalid_relation'. Not a recognized relationship. Available relationships: project, workspace
```

## Examples

### Simple includes

```json
{
  "method": "project_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "description": true
    }
  }
}
```

Result:
```json
{
  "data": [
    { "id": 1, "name": "Project 1", "description": "..." }
  ]
}
```

### BelongsTo relationship with empty object (default columns)

```json
{
  "method": "project_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "workspace": {}
    }
  }
}
```

This is equivalent to:
```json
{
  "$includes": {
    "_defaults": true,
    "workspace": {
      "_defaults": true
    }
  }
}
```

Result:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Project 1",
      "wksId": 1001,
      "workspace": {
        "id": 1001,
        "name": "Workspace 1"
      }
    }
  ]
}
```

### BelongsTo relationship with specific columns

```json
{
  "method": "ticket_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "project": {
        "_defaults": true,
        "description": true
      }
    }
  }
}
```

Result:
```json
{
  "data": [
    {
      "id": 1,
      "title": "Ticket 1",
      "project": {
        "id": 1,
        "name": "Project 1",
        "description": "..."
      }
    }
  ]
}
```

### HasMany relationship

```json
{
  "method": "project_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "tickets": {
        "_defaults": true,
        "status": true
      }
    }
  }
}
```

Result:
```json
{
  "data": [
    {
      "id": 1,
      "name": "Project 1",
      "tickets": [
        { "id": 1, "title": "Ticket 1", "status": "open" },
        { "id": 2, "title": "Ticket 2", "status": "closed" }
      ]
    }
  ]
}
```

### Many-to-Many relationship

```json
{
  "method": "user_list",
  "params": {
    "$includes": {
      "_defaults": true,
      "roles": {
        "_defaults": true
      }
    }
  }
}
```

Configuration in DAO:
```typescript
{
  type: 'hasMany',
  targetTable: 'role',
  foreignKey: 'roleId',
  junctionTable: 'user_role',
  junctionSourceKey: 'userId',
  junctionTargetKey: 'roleId'
}
```

Result:
```json
{
  "data": [
    {
      "id": 1,
      "username": "user1",
      "roles": [
        { "id": 1, "name": "Admin" },
        { "id": 2, "name": "Editor" }
      ]
    }
  ]
}
```

### Deep nesting

```json
{
  "method": "ticket_list",
  "params": {
    "$includes": {
      "project": {
        "_defaults": true,
        "workspace": {
          "_defaults": true,
          "owner": {
            "_defaults": true
          }
        }
      }
    }
  }
}
```

Result:
```json
{
  "data": [
    {
      "id": 1,
      "title": "Ticket 1",
      "project": {
        "id": 1,
        "name": "Project 1",
        "workspace": {
          "id": 1,
          "name": "Workspace 1",
          "owner": {
            "id": 1,
            "username": "owner1"
          }
        }
      }
    }
  ]
}
```

### Complete Query with Filters, Includes, and Pagination

```json
{
  "jsonrpc": "2.0",
  "method": "ticket_list",
  "params": {
    "$filters": {
      "status": "open",
      "priority": { "$gt": 3 }
    },
    "$includes": {
      "_defaults": true,
      "description": true,
      "project": {},
      "assignee": {
        "_defaults": true,
        "fullName": true
      }
    },
    "$orderBy": "!priority",
    "$limit": 100
  },
  "id": null
}
```

## Best Practices

1. **Use empty objects for default nested columns**: `{ "project": {} }` is cleaner than `{ "project": { "_defaults": true } }`
2. **Use column groups**: Prefer `_defaults`, `_timestamps` over listing individual columns
3. **Limit nesting depth**: Deep nesting can impact performance
4. **Select only needed columns**: Avoid selecting unused columns for better performance
5. **Use belongsTo for single relations**: Prefer belongsTo over hasOne when possible (single query vs batch)
6. **Use many-to-many sparingly**: Consider caching for frequently accessed many-to-many relations
7. **Validate includes client-side**: Prevent invalid includes before sending requests

## Error Handling

All include validation errors occur before SQL generation, providing clear error messages:

- Invalid column names
- Invalid group names
- Invalid relationship names
- Missing many-to-many configuration

```typescript
// Example error
throw new Error(
  "Invalid column 'unknown_field'. Available columns: id, name, description"
);
```
