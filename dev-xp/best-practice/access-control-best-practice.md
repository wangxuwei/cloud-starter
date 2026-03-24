# Access Control Best Practices

This document explains how to configure and use the access control system in this codebase.

## Overview

The access control system is based on a decorator-based approach using `@AccessRequires` to enforce permissions at the DAO (Data Access Object) method level. The system supports two levels of access control:

- **Global Access**: System-wide permissions (e.g., `a_admin`, `a_api`)
- **Organization Access**: Scoped to specific organizations (e.g., `org_a_content_view`, `org_a_content_create`)

## Access Types

### Global Accesses

Global accesses are defined in `shared/src/access-types.ts` and apply system-wide:

```typescript
const GLOBAL_ACCESSES = freeze([
  "#sys", // this is a special access only for getSysContext
  "#user", // any logged request (api or user) get the special #user access
  "a_ui", // ui web interface access (web login). Can be negated in user.accesses modifiers
  "a_api", // for API access. Can be added in user.accesses modifiers
  "a_admin", // all basic admin tasks
  "a_pwd_reset", // password reset
  "a_admin_edit_user", // ability to reset user information
] as const);
```

### Global Roles

Global roles are mapped to global accesses:

- **`r_sys`**: System context with `#sys` access only
- **`r_user`**: Regular user with `#user` and `a_ui` accesses
- **`r_admin`**: Administrator with all r_user accesses plus `a_admin`, `a_admin_edit_user`, and `a_pwd_reset`

Role to access mappings in `access-types.ts`:

```typescript
const r_sys: Readonly<GlobalAccess[]> = freeze(["#sys"]);
const r_user: Readonly<GlobalAccess[]> = freeze(["#user", "a_ui"]);
const r_admin: Readonly<GlobalAccess[]> = freeze([
  ...r_user,
  "a_admin",
  "a_admin_edit_user",
  "a_pwd_reset",
]);
```

### Organization Accesses

Organization accesses are defined in `shared/src/access-types.ts` and apply within an organization context:

```typescript
const ORG_ACCESSES = freeze([
  "org_a_delete",                 // Delete the organization
  "org_a_user_assign_admin",      // Add user admin (only owner)
  "org_a_content_create",         // Create new content for this org
  "org_a_content_edit",           // Edit content in this org
  "org_a_content_view",           // View info and tickets from a Orgs
  "org_a_wks_manage",             // Manage workspaces in this org
  "org_a_project_manage",         // Manage projects in this org
  "org_a_user_add",               // Add user to this org
  "org_a_user_remove",            // Remove user from this org
] as const);
```

### Organization Roles

Organization roles grant a set of org accesses in `shared/src/access-types.ts`:

- **`org_r_owner`**: Full privileges on the org (all org accesses)
- **`org_r_admin`**: Full privileges except delete and user admin assignment
- **`org_r_editor`**: Can create and edit content, manage projects and workspaces
- **`org_r_viewer`**: View content only

Role to access mappings:

```typescript
const org_r_viewer: Readonly<OrgAccess[]> = freeze(["org_a_content_view"]);
const org_r_editor: Readonly<OrgAccess[]> = freeze([
  ...org_r_viewer,
  "org_a_content_create",
  "org_a_content_edit",
  "org_a_project_manage",
  "org_a_wks_manage",
]);
const org_r_admin: Readonly<OrgAccess[]> = freeze([
  ...org_r_editor,
  "org_a_user_remove",
  "org_a_user_add",
]);
const org_r_owner: Readonly<OrgAccess[]> = ORG_ACCESSES;
```

## Using @AccessRequires Decorator

The `@AccessRequires` decorator is the primary way to enforce access control. It can accept multiple access requirements. The method passes if ANY of the requirements is met.

### Syntax

```typescript
@AccessRequires(...accessList: Access[])
async methodName(utx: UserContext, ...args) {
  // method implementation
}
```

### Access Types Supported

1. **Global Access**: `a_admin`, `a_api`, `a_ui`, etc.
   - Checks `utx.hasAccess(access)`

2. **System Access**: `#sys`, `#user`
   - Special system-level access

3. **Entity Match**: `@id`, `@cid`, `@userId`
   - Matches `utx.userId` with the specified property of the second argument
   - Used to ensure users can only access their own data

4. **Org Access**: `org_a_content_view`, `org_a_project_manage`, etc.
   - Checks `utx.hasOrgAccess(orgId, access)`
   - Requires either `utx.orgId` to be set or `queryOptions.access` to match

### Examples from Codebase

#### Single Global Access

```typescript
@AccessRequires('#user')
async create(utx: UserContext, data: Partial<Org>) {
  // Any user can create a new org
  const orgId = await super.create(utx, data);
  await saveOrgRole(utx.userId, orgId, 'org_r_owner');
  return orgId;
}
```

#### Multiple Access Options (Any Match)

```typescript
@AccessRequires('a_admin', 'org_a_content_view')
async get(utx: UserContext, id: number) {
  // Passes if user has a_admin OR org_a_content_view
  return super.get(utx, id);
}
```

#### Entity Match (Own Data Only)

```typescript
@AccessRequires('org_a_content_edit', '@cid')
async update(utx: UserContext, id: I, data: Partial<E>) {
  // Passes if user has org_a_content_edit OR if utx.userId === data.cid
  this.scopeData(utx, data);
  return super.update(utx, id, data);
}
```

#### Org-Scoped Access

```typescript
@AccessRequires('org_a_content_view')
async get(utx: UserContext, id: I): Promise<E> {
  this.scopeData(utx);
  return super.get(utx, id);
}
```

## DAO Access Control Patterns

### BaseDao Pattern

`BaseDao` methods are protected with `@AccessRequires()` (no arguments), which forces `#sys` only access. Subclasses override with appropriate access controls.

```typescript
// BaseDao
@AccessRequires()
async get(utx: UserContext, id: I): Promise<E> {
  // Only system context can call base implementation
}

// OrgScopedDao override
@AccessRequires('org_a_content_view')
async get(utx: UserContext, id: I): Promise<E> {
  // Users with org_a_content_view can call
  this.scopeData(utx);
  return super.get(utx, id);
}
```

### OrgScopedDao Pattern

`OrgScopedDao` provides organization-scoped data access with built-in scoping:

```typescript
export class OrgScopedDao<E extends OrgScopedEntity, I> extends BaseDao<E, I> {
  @AccessRequires('org_a_content_view')
  async get(utx: UserContext, id: I): Promise<E> {
    this.scopeData(utx);  // Ensures utx.orgId is set
    return super.get(utx, id);
  }

  @AccessRequires('org_a_content_create')
  async create(utx: UserContext, data: Partial<E>): Promise<I> {
    this.scopeData(utx, data);  // Sets orgId on data
    return super.create(utx, data);
  }

  scopeQuery(utx: UserContext, queryOptions?: Q & CustomQuery) {
    const orgId = utx.orgId;
    if (orgId == null) {
      throw new Err(ERROR.NO_ORGID_IN_UTX);
    }
    queryOptions = queryOptions ?? {};
		orgScopedQueryOptions.filters = ensureArray(orgScopedQueryOptions.filters ?? {});
		orgScopedQueryOptions.filters.push({orgId: orgId});
  }

  scopeData(utx: UserContext, data?: Partial<OrgScopedEntity>) {
    const orgId = utx.orgId;
    if (orgId == null) {
      throw new Err(ERROR.NO_ORGID_IN_UTX);
    }
    if (data != null) {
      data.orgId = orgId;  // Set orgId on data
    }
  }
}
```

## User Access Configuration

### Global Access

Users have global access through their `role` field in the `user` table:

```typescript
interface User {
  id: number;
  username: string;
  role: GlobalRoleName;  // 'r_sys', 'r_user', or 'r_admin'
  accesses?: string[];    // Optional access modifiers
}
```

Accesses are parsed in `UserDao.parseAccess`:

```typescript
static parseAccess(rawUserObj: { role: GlobalRoleName, accesses?: string[] }): Readonly<{ [key in GlobalAccess]?: true }> {
  const { role, accesses } = rawUserObj;
  const userAccesses = new Set<GlobalAccess>();

  // Add all accesses from the role
  GLOBAL_ROLES.get(role)?.forEach(a => userAccesses.add(a));

  // Process access modifiers (e.g., '!a_admin' to revoke)
  if (accesses) {
    for (const accessModifier of accesses) {
      let accessName = accessModifier;
      let negate = false;
      if (accessModifier.startsWith('!')) {
        accessName = accessModifier.substring(1);
        negate = true;
      }
      if (isAccess(accessName)) {
        if (negate) {
          userAccesses.delete(accessName);
        } else {
          userAccesses.add(accessName);
        }
      }
    }
  }

  return Object.freeze(Array.from(userAccesses.values())
    .reduce((acc, val) => { acc[val] = true; return acc },
      {} as { [key in GlobalAccess]?: true }));
}
```

### Organization Access

Users have organization-specific access through the `user_org` junction table:

```typescript
// user_org table schema
// - userId: number
// - orgId: number
// - role: string (org_r_owner, org_r_admin, etc.)
```

Saving an org role:

```typescript
export async function saveOrgRole(userId: number, orgId: number, role: OrgRoleName) {
  const k = await getKnexClient();
  const sql = `insert into user_org ("userId", "orgId", role) values (?, ?, ?) 
    on conflict on CONSTRAINT user_org_pkey do update set role = ?`;
  const values = [userId, orgId, role, role];
  return await k.raw(sql, values);
}
```

Getting org accesses:

```typescript
export async function getOrgAccesses(userId: number, orgId: number) {
  const k = await getKnexClient();
  let query = k('user_org');
  query.where({ userId, orgId });
  const records = await query.then() as any[];

  const accessList = [];
  for (const record of records) {
    const role = record.role;
    const privs = ORG_ROLES.get(role);
    if (privs) {
      accessList.push(...privs);
    }
  }

  return accessList;
}
```

## Org Entity Processing

Organization entities have an `accesses` property computed from the user's role in that org:

```typescript
protected parseRecord(obj: any): Org {
  const entity = super.parseRecord(obj) as any;

  // If .wrole exists, create the accesses object from the role
  if (entity.wrole) {
    const accessList = ORG_ROLES.get(entity.wrole) as Readonly<OrgAccess[]>;
    entity.accesses = Object.freeze(accessList?.reduce(
      (acc, val) => { acc[val] = true; return acc },
      {} as { [key in OrgAccess]?: true }));

    // Remove wrole, nobody should use it after this
    delete entity['wrole'];
  }

  return entity as Org;
}
```

## Best Practices

### 1. Always Define Access Requirements

Never leave DAO methods without access control. Always use `@AccessRequires`:

```typescript
// Good
@AccessRequires('org_a_content_view')
async get(utx: UserContext, id: number) {
  return super.get(utx, id);
}

// Bad
async get(utx: UserContext, id: number) {
  return super.get(utx, id);
}
```

### 2. Use Multiple Access Options for Flexible Permissions

When appropriate, allow multiple ways to access a method:

```typescript
// Passes if user is admin OR has org content edit permission OR is the creator
@AccessRequires('a_admin', 'org_a_content_edit', '@cid')
async update(utx: UserContext, id: number, data: Partial<E>) {
  return super.update(utx, id, data);
}
```

### 3. Use Entity Match for User-Scoped Data

When users should only access their own data:

```typescript
@AccessRequires('@id')
async get(utx: UserContext, id: number) {
  // Only passes if utx.userId === id
  return super.get(utx, id);
}
```

### 4. Always Scope Org Data

When working with org-scoped data, always use the scoping helpers:

```typescript
@AccessRequires('org_a_content_create')
async create(utx: UserContext, data: Partial<E>): Promise<I> {
  this.scopeData(utx, data);  // Ensures orgId is set
  return super.create(utx, data);
}
```

### 5. Use Specific Accesses, Not Generic Ones

Define specific accesses rather than using generic ones:

```typescript
// Good - specific access
@AccessRequires('org_a_project_manage')
async list(utx: UserContext, queryOptions?: QueryOptions<Project>) {
  return super.list(utx, queryOptions);
}

// Avoid - too generic
@AccessRequires('org_a_content_edit')
async list(utx: UserContext, queryOptions?: QueryOptions<Project>) {
  return super.list(utx, queryOptions);
}
```

### 6. Override BaseDao Methods Explicitly

When inheriting from BaseDao, always override methods with appropriate access:

```typescript
export class ProjectDao extends OrgScopedDao<Project, number> {
  @AccessRequires('a_admin', 'org_a_project_manage')
  async get(utx: UserContext, id: number) {
    return super.get(utx, id);
  }

  @AccessRequires('a_admin', 'org_a_project_manage')
  async list(utx: UserContext, queryOptions?: QueryOptions<Project>) {
    return super.list(utx, queryOptions);
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

### 7. Use OrgQueryOptions for Org List Queries

When listing orgs, use the `OrgQueryOptions` with required access:

```typescript
export interface OrgQueryOptions extends QueryOptions<Org> {
  access: OrgAccess  // REQUIRED - specifies access needed
}

@AccessRequires('a_admin', 'org_a_content_view')
@Monitor()
async list(utx: UserContext, queryOptions?: OrgQueryOptions): Promise<Org[]> {
  const queryAccess = queryOptions?.access;

  if (utx.hasAccess('#sys') || utx.hasAccess('a_admin')) {
    return super.list(utx, queryOptions);
  }
  else if (queryAccess === 'org_a_content_view') {
    // Query based on user's org roles
    const roles = ORG_ROLES_BY_ACCESS.get(queryAccess)!;
    const { query } = await knexQuery({ utx, tableName: this.table });
    // ... join with user_org and filter by roles
  }
}
```

## Adding New Accesses or Roles

### Adding a New Global Access

1. Add to `shared/src/access-types.ts`:

```typescript
const GLOBAL_ACCESSES = freeze([
  // ... existing accesses
  'a_new_access',  // New access
] as const);
```

2. Add to role mappings if needed:

```typescript
const r_sys: Readonly<GlobalAccess[]> = freeze([...existingAccesses, 'a_new_access']);
```

3. Update `services/_common/src/da/role/global.ts` for JSON generation:

```typescript
export const globalAccessEnum = freeze({
  // ... existing accesses
  'a_new_access': 'a_new_access',
} as const);
```

### Adding a New Org Access

1. Add to `shared/src/access-types.ts`:

```typescript
const ORG_ACCESSES = freeze([
  // ... existing accesses
  'org_a_new_access',  // New access
] as const);
```

2. Add to appropriate roles:

```typescript
const org_r_owner: Readonly<OrgAccess[]> = freeze([...existingAccesses, 'org_a_new_access']);
```

3. Update `services/_common/src/da/role/org.ts` for JSON generation:

```typescript
export const orgAccessEnum = freeze({
  // ... existing accesses
  'org_a_new_access': 'org_a_new_access',
} as const);
```

### Adding a New Role

Define the role with its accesses in `shared/src/access-types.ts`:

```typescript
const org_r_new_role: Readonly<OrgAccess[]> = freeze([
  'org_a_content_view',
  // ... specific accesses for this role
]);

const _ORG_ROLES = freeze({
  // ... existing mappings
  org_r_new_role: org_r_new_role,
} as const);
```

Then add to `services/_common/src/da/role/org.ts`:

```typescript
export const orgRoleEnum = freeze({
  // ... existing roles
  org_r_new_role: 'org_r_new_role',
} as const);
```

## Common Access Control Scenarios

### Scenario 1: Public Resource Access

```typescript
// Any authenticated user can access
@AccessRequires('#user')
async create(utx: UserContext, data: Partial<Org>) {
  return super.create(utx, data);
}
```

### Scenario 2: Admin or Org Role

```typescript
// System admin OR users with specific org role
@AccessRequires('a_admin', 'org_a_project_manage')
async update(utx: UserContext, id: number, data: Partial<Project>) {
  return super.update(utx, id, data);
}
```

### Scenario 3: Owner or Creator

```typescript
// Admin OR the user who created the resource
@AccessRequires('org_a_content_edit', '@cid')
async update(utx: UserContext, id: number, data: Partial<E>) {
  return super.update(utx, id, data);
}
```

### Scenario 4: Cross-Organization Access

```typescript
// Admin can access any org, regular users only their own
@AccessRequires('a_admin', 'org_a_content_view')
async get(utx: UserContext, id: number) {
  // Logic to verify user belongs to org if not admin
  return super.get(utx, id);
}
```

## Security Considerations

1. **Never trust client-provided data**: Always validate access on the server side using `@AccessRequires`
2. **Use the least privilege principle**: Grant only the minimum access needed
3. **Audit access changes**: Track changes to user roles and permissions
4. **Regular reviews**: Periodically review access definitions and mappings
5. **Test access controls**: Ensure access controls work as expected with comprehensive tests

## Error Handling

When access is denied, the decorator throws an `AccessFail` exception:

```typescript
if (!pass) {
  throw new AccessFail(`User ${userId} does not have the necessary access for "${methodRef}" ${(entityId != null) ? `[${entityId}]` : ''} , access: [${accessList.join(',')}]`);
}
```

When the decorator is misused, it throws an `AccessDecoratorError`:

```typescript
throw new AccessDecoratorError(`First argument must be a "UserContext"`);
```

## Related Files

- `shared/src/access-types.ts` - Main source of truth for all role and access definitions
- `services/_common/src/da/access.ts` - Access decorator and logic
- `services/_common/src/da/access-org.ts` - Org-specific access functions
- `services/_common/src/da/dao-base.ts` - Base DAO with default access controls
- `services/_common/src/da/dao-org-scoped.ts` - Org-scoped DAO base class
- `services/_common/src/da/dao-org.ts` - Organization DAO implementation
- `services/_common/src/da/dao-user.ts` - User DAO implementation
- `services/_common/src/da/role/global.ts` - Global role and access enums for JSON generation
- `services/_common/src/da/role/org.ts` - Organization role and access enums for JSON generation
