# Entity Best Practices

This document outlines the best practices for creating entities in the codebase.

## File Structure

Entities are typically split between:

- `shared/src/entities-base.ts` - Base interfaces and types used across entities
- `shared/src/entities.ts` - Specific entity definitions

## Base Entity Patterns

### StampedEntity

All entities that require timestamp tracking should extend `StampedEntity`. This provides audit fields:

```typescript
export interface StampedEntity {
	cid?: number,    // Creator user id
	ctime?: string,  // Creation time (ISO string)
	mid?: number,    // Modifier user id
	mtime?: string   // Modification time (ISO string)
}
```

### OrgScopedEntity

Entities that belong to an organization should extend `OrgScopedEntity`:

```typescript
export interface OrgScopedEntity {
	orgId: number;
}
```

## Entity Definition Guidelines

### 1. Define Column Constants

For database entities, define a frozen constant with column names before the interface:

```typescript
export const USER_COLUMNS = Object.freeze(['id', 'uuid', 'username', 'cid', 'ctime', 'mid', 'mtime'] as const);
type UserPropName = typeof USER_COLUMNS[number];
```

### 2. Use Region Markers

Organize related code using region markers:

```typescript
//#region    ---------- User ----------
// Default user columns (more defined in dao-user for auth, login, ...)
export const USER_COLUMNS = Object.freeze(['id', 'uuid', 'username', 'cid', 'ctime', 'mid', 'mtime'] as const);
type UserPropName = typeof USER_COLUMNS[number];

export interface User extends StampedEntity {
	id: number;
	uuid: string;
	username: string;
}
//#endregion ---------- /User ----------
```

### 3. Entity Interface Structure

Entities should:
- Have an `id` of type `number`
- Optionally have a `uuid` of type `string`
- Extend appropriate base interfaces (`StampedEntity`, `OrgScopedEntity`)
- Include clear property comments where context is needed

```typescript
export interface Media extends StampedEntity, OrgScopedEntity {
	id: number;
	projectId: number;
	type: MediaType;
	uuid: string;
	srcName: string; // the orginal source name
	name: string;    // the name of the main media file
	folderPath: string;
	sd: MediaResolution;
	url: string;     // set by MediaDao.parseRecord
	sdUrl?: string;  // set by MediaDao.parseRecord
}
```

### 4. Type Definitions

Define related types near the entity interface:

```typescript
export type MediaType = 'video' | 'image';
export type MediaResolution = '480p30' | '360p30';
export type JobState = 'new' | 'started' | 'completed' | 'skipped' | 'failed';
```

Use union types for enum-like values that have a limited set of options.

### 5. Optional Properties

Mark properties as optional with `?` when they may not always be present:

```typescript
export interface Org extends StampedEntity {
	id: number;
	uuid: string;
	name: string;
	accesses?: OrgAccesses  // Optional, populated as needed
}
```

### 6. Complex Properties

For complex nested properties, provide type annotations and context:

```typescript
export interface Job {
	id: number;
	state: JobState;
	event: JobEventName;
	orgId?: number; // can be undefined when not for a workspace
	onEntity?: string; // the entity type name e.g., "Media"
	onId?: number;    // the entity id
	progress?: { [name: string]: number }; // step progress (0 to 100), names are snake format
	err_code?: string; // only if state = failed
	err_msg?: string;  // only if state = failed
}
```

## Query-Related Types

Entities often work with query types defined in `entities-base.ts`:

### QueryOptions

Use `QueryOptions<E>` for typed query parameters:

```typescript
export interface QueryOptions<E> {
	matching?: {
		[C in keyof E]?: E[C] | { op: Op, val: E[C] };
	};
	ids?: number[];
	orderBy?: string;
	limit?: number;
	offset?: number;
	filters?: QueryFilters;
}
```

## Common Patterns

### UUID + ID Pattern

Most entities have both a numeric `id` and a string `uuid`:

```typescript
export interface Wks extends StampedEntity, OrgScopedEntity {
	id: number;
	uuid: string;
	name: string;
}
```

### Calculated/Runtime Properties

Properties that are set by data access layer should be documented:

```typescript
export interface Media extends StampedEntity, OrgScopedEntity {
	id: number;
	url: string;     // set by MediaDao.parseRecord
	sdUrl?: string;  // set by MediaDao.parseRecord
}
```

### Cross-Entity References

Reference other entities by ID, not by the entity type itself:

```typescript
export interface Media extends StampedEntity, OrgScopedEntity {
	id: number;
	projectId: number;  // Reference to Project entity by ID
	orgId: number;      // From OrgScopedEntity
}
```

## Naming Conventions

- Interface names: PascalCase (e.g., `Media`, `User`)
- Column constants: UPPER_SNAKE_CASE with `_COLUMNS` suffix (e.g., `USER_COLUMNS`)
- Type aliases: PascalCase (e.g., `MediaType`, `JobState`)
- Property names: camelCase (e.g., `folderPath`, `createTime`)

## Export Pattern

In `entities.ts`, re-export base types from `entities-base.ts`:

```typescript
export * from './entities-base.js';
```

This provides a single import point for consumers.
