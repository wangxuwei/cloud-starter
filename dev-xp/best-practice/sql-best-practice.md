# SQL Best Practices

This document outlines the SQL best practices based on the database schema used in the project.

## Database Creation

Create a dedicated user with appropriate privileges and a database with UTF-8 encoding.

```sql
CREATE USER cstar_user PASSWORD 'welcome' SUPERUSER;
CREATE DATABASE cstar_db owner cstar_user ENCODING = 'UTF-8';
```

## Schema Organization

### Using Regions

Organize related database objects using region markers for better navigation and maintainability.

```sql
-- #region:    --- User
-- ... user related objects
-- #endregion: --- User
```

### Naming Conventions

- **Tables**: Use lowercase, singular names (e.g., `user`, `org`, `project`)
- **Columns**: Use camelCase for multi-word columns (e.g., `fullName`, `srcName`, `folderPath`)
- **Foreign keys**: Use the format `"tableNameId"` (e.g., `"userId"`, `"orgId"`)
- **Primary keys**: Use `id` with `bigserial` type
- **UUIDs**: Use `uuid` column with `DEFAULT gen_random_uuid()`

## Enum Types

Define enum types with descriptive prefixes to indicate their scope.

```sql
CREATE TYPE user_role AS ENUM (
  'r_sys',
  'r_user'
);

CREATE TYPE user_access AS ENUM (
  'a_ui',
  '!a_ui',
  'a_api',
  '!a_api'
);
```

Prefix patterns:
- `r_` for roles
- `a_` for access permissions
- `!a_` for negative access permissions
- `org_` for organization-scoped types

## Table Structure

### Primary Keys

Always use `bigserial` for primary keys and restart sequences at 1000 to reserve IDs for development, testing, and administrative purposes.

```sql
CREATE TABLE "user" (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  -- ... other columns
);

ALTER SEQUENCE user_id_seq
  RESTART WITH 1000;
```

### Columns with Default Values

Set appropriate default values for frequently used patterns.

```sql
psalt uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
tsalt uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
```

### Timestamps

Include audit timestamps for all tables that track creation and modification.

```sql
cid bigint,             -- creator ID
ctime timestamp with time zone,
mid bigint,             -- modifier ID
mtime timestamp with time zone
```

## Foreign Keys

### Naming Convention

Use quoted foreign key column names with the table name prefix.

```sql
"userId" bigint NOT NULL,
"orgId" bigint NOT NULL,
"projectId" bigint NOT NULL
```

### Cascade Delete

Use `ON DELETE CASCADE` for child tables to maintain referential integrity automatically.

```sql
CREATE TABLE "user_org" (
  "userId" bigint NOT NULL,
  "orgId" bigint NOT NULL,
  role org_role_name NOT NULL,
  PRIMARY KEY ("userId", "orgId"),
  FOREIGN KEY ("userId") REFERENCES "user" (id) ON DELETE CASCADE,
  FOREIGN KEY ("orgId") REFERENCES "org" (id) ON DELETE CASCADE
);
```

## Array Types

Use PostgreSQL arrays for storing multiple related values.

```sql
accesses user_access[],
pwdHistory varchar(128)[],
resList media_res[]
```

## Junction Tables

For many-to-many relationships, create a junction table with a composite primary key.

```sql
CREATE TABLE "ticket_project" (
  "ticketId" bigint NOT NULL,
  "projectId" bigint NOT NULL,
  PRIMARY KEY ("ticketId", "projectId"),
  FOREIGN KEY ("ticketId") REFERENCES "ticket" (id) ON DELETE CASCADE,
  FOREIGN KEY ("projectId") REFERENCES "project" (id) ON DELETE CASCADE
);
```

## JSONB Columns

Use `jsonb` for flexible data storage, particularly for configuration, requests, and responses.

```sql
todo jsonb,
done jsonb,
progress jsonb
```

## Unique Constraints

Always add unique constraints where appropriate, especially for UUIDs and identifying fields.

```sql
uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
username varchar(64) NOT NULL UNIQUE
```

## Column Types and Lengths

Use appropriate data types and lengths based on expected content.

```sql
-- Identifiers
id bigserial PRIMARY KEY

-- UUIDs
uuid uuid NOT NULL UNIQUE

-- Text fields with specific lengths
username varchar(64) NOT NULL UNIQUE
"fullName" varchar(92)
name varchar(64)
title varchar(64)

-- Longer text
"desc" text

-- Password hashes
pwd varchar(128)

-- Tokens
oauth_token varchar(256)
```

## Reserved Keywords

Quote column names that are SQL reserved keywords.

```sql
"type" oauth_type NOT NULL DEFAULT 'google',
"role" org_role_name NOT NULL
```

## Database Reset

Create a drop script for clean database recreation.

```sql
DROP DATABASE IF EXISTS cstar_db;
DROP USER IF EXISTS cstar_user;
```

## Seeding

Create seed scripts for initial data, focusing on administrative and demo accounts.

```sql
INSERT INTO "user" (id, role, username) VALUES (1, 'r_sys', 'sysadmin');
INSERT INTO "user" (id, role, username) VALUES (2, 'r_user', 'demo1');
```
