# Access Control Best Practices

This document explains how to configure and use the access control system in this codebase.

## Overview

The access control system is based on a decorator-based approach using `@AccessRequires` to enforce permissions at the DAO (Data Access Object) method level. The system supports two levels of access control:

- **Global Access**: System-wide permissions (e.g., `a_admin`, `a_orgs_list`)
- **Organization Access**: Scoped to specific organizations (e.g., `org_a_content_view`, `org_a_content_create`)

## Access Types

### Global Accesses

Global accesses are defined in `services/_common/src/da/role/global.ts` and apply system-wide:

```typescript
export const globalAccessEnum = freeze({
  a_web_login: 'a_web_login',    // Access to web login
  a_api: 'a_api',                // Access to API
  a_orgs_list: 'a_orgs_list',    // List organizations
  a_orgs_create: 'a_orgs_create',// Create organizations
  a_orgs_update: 'a_orgs_update',// Update organizations
  a_orgs_delete: 'a_orgs_delete',// Delete organizations
  a_users_list: 'a_users_list',  // List users
  a_users_create: 'a_users_create',// Create users
  a_users_update: 'a_users_update',// Update users
  a_users_delete: 'a_users_delete',// Delete users
} as const);
```

### Global Roles

Global roles are mapped to global accesses:

- **`r_sys`**: System administrator with all accesses
- **`r_user`**: Regular user with basic accesses (`a_web_login`, `a_orgs_create`)

Role to access mappings:

```typescript
// r_sys role has all global accesses
const R_SYS_ACCESSES = [
  'a_web_login', 'a_api', 
  'a_orgs_list', 'a_orgs_create', 'a_orgs_update', 'a_orgs_delete',
  'a_users_list', 'a_users_create', 'a_users_update', 'a_users_delete'
];

// r_user role has basic accesses
const R_USER_ACCESSES = ['a_web_login', 'a_orgs_create'];
```

### Organization Accesses

Organization accesses are defined in `services/_common/src/da/role/org.ts` and apply within an organization context:

Based on the codebase, the following org accesses are used:

- `org_a_content_view`: View content in the org
- `org_a_content_create`: Create content in the org
- `org_a_content_edit`: Edit content in the org
- `org_a_project_manage`: Manage projects in the org
- `org_a_wks_manage`: Manage workspaces in the org
- `org_a_user_assign_admin`: Assign admin roles to users
- `org_a_delete`: Delete the org

### Organization Roles

Organization roles grant a set of org accesses:

- **`org_r_owner`**: Full privileges on the org (including delete and rename)
- **`org_r_admin`**: Full privileges except delete and rename
- **`org_r_editor`**: Edit content
- **`org_r_viewer`**: View content
- **`org_r_member`**: Basic member

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

1. **Global Access**: `a_admin`, `a_orgs_list`, etc.
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
  role: GlobalRoleName;  // 'r_sys' or 'r_user'
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

1. Add to `services/_common/src/da/role/global.ts`:

```typescript
export const globalAccessEnum = freeze({
  // ... existing accesses
  a_new_access: 'a_new_access',
} as const);
```

2. Add to role mappings if needed:

```typescript
const R_SYS_ACCESSES = [...existingAccesses, 'a_new_access'];
```

### Adding a New Org Access

1. Add to `services/_common/src/da/role/org.ts`:

```typescript
export const orgAccessEnum = freeze({
  a_web_login: 'a_web_login',
  org_a_new_access: 'org_a_new_access',  // New access
} as const);
```

2. Define in shared `access-types.ts` the mapping from role to access:

```typescript
export const ORG_ROLES = new Map<OrgRoleName, Readonly<OrgAccess[]>>([
  ['org_r_owner', Object.freeze([
    'org_a_content_view',
    'org_a_content_create',
    'org_a_content_edit',
    'org_a_new_access',  // Add new access
    // ... other accesses
  ])],
  // ... other roles
]);
```

### Adding a New Role

Define the role with its accesses:

```typescript
export const orgRoleEnum = freeze({
  // ... existing roles
  org_r_new_role: 'org_r_new_role',
} as const);

export const ORG_ROLES = new Map<OrgRoleName, Readonly<OrgAccess[]>>([
  // ... existing mappings
  ['org_r_new_role', Object.freeze([
    'org_a_content_view',
    // ... specific accesses for this role
  ])],
]);
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

- `services/_common/src/da/access.ts` - Access decorator and logic
- `services/_common/src/da/access-org.ts` - Org-specific access functions
- `services/_common/src/da/dao-base.ts` - Base DAO with default access controls
- `services/_common/src/da/dao-org-scoped.ts` - Org-scoped DAO base class
- `services/_common/src/da/dao-org.ts` - Organization DAO implementation
- `services/_common/src/da/dao-user.ts` - User DAO implementation
- `services/_common/src/da/role/global.ts` - Global role and access definitions
- `services/_common/src/da/role/org.ts` - Organization role and access definitions
- `shared/src/access-types.ts` - Shared access type definitions
