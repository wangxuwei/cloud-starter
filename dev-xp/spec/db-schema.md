# Database Schema Documentation

This document describes the database schema used in the cstar application.

## Overview

The database consists of the following main entities:
- User and authentication
- OAuth integration
- Organization management
- Workspace management
- Project management
- Media management
- Job processing

## Tables

### user

Global user accounts with roles and access permissions.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | PRIMARY KEY |
| uuid | uuid | Unique identifier | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| username | varchar(64) | Login username | NOT NULL, UNIQUE |
| fullName | varchar(92) | User's full name | |
| role | user_role | Global role (r_sys, r_user) | NOT NULL, DEFAULT: 'r_user' |
| accesses | user_access[] | Array of access modifiers | |
| pwd | varchar(128) | Encrypted password | |
| psalt | uuid | Password encryption salt | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| pwdHistory | varchar(128)[] | History of previous passwords | |
| tsalt | uuid | Token salt for session cookie | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| cid | bigint | Creator ID | |
| ctime | timestamp with time zone | Creation timestamp | |
| mid | bigint | Modifier ID | |
| mtime | timestamp with time zone | Modification timestamp | |

**Note**: ID sequence starts at 1000 for dev, test, and administrative purposes.

---

### prlink

Password reset links for users.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | |
| userId | bigint | Reference to user | NOT NULL, UNIQUE, FOREIGN KEY → user(id) ON DELETE CASCADE |
| code | uuid | Reset code | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| clickFirst | timestamp with time zone | First click timestamp | |
| clickLast | timestamp with time zone | Last click timestamp | |
| clickCount | int | Number of clicks | |

---

### oauth

OAuth provider integration credentials.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | PRIMARY KEY |
| type | oauth_type | OAuth provider (google, github) | NOT NULL, DEFAULT: 'google' |
| userId | bigint | Reference to user | NOT NULL, FOREIGN KEY → user(id) ON DELETE CASCADE |
| oauth_id | varchar(128) | Provider's user ID | |
| oauth_name | varchar(64) | Provider's user name | |
| oauth_username | varchar(64) | Provider's username | |
| oauth_token | varchar(256) | OAuth token | |
| oauth_picture | varchar(128) | Profile picture URL | |
| cid | bigint | Creator ID | |
| ctime | timestamp with time zone | Creation timestamp | |
| mid | bigint | Modifier ID | |
| mtime | timestamp with time zone | Modification timestamp | |

**Note**: ID sequence starts at 1000.

---

### org

Organizations (personal or group).

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | PRIMARY KEY |
| uuid | uuid | Unique identifier | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| type | org_type | Organization type (personal, group) | NOT NULL, DEFAULT: 'personal' |
| name | varchar(64) | Organization name | |
| cid | bigint | Creator ID | |
| ctime | timestamp with time zone | Creation timestamp | |
| mid | bigint | Modifier ID | |
| mtime | timestamp with time zone | Modification timestamp | |

**Note**: ID sequence starts at 1000.

---

### wks

Workspaces within organizations.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | PRIMARY KEY |
| uuid | uuid | Unique identifier | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| orgId | bigint | Reference to organization | NOT NULL, FOREIGN KEY → org(id) ON DELETE CASCADE |
| cid | bigint | Creator ID | |
| ctime | timestamp with time zone | Creation timestamp | |
| mid | bigint | Modifier ID | |
| mtime | timestamp with time zone | Modification timestamp | |
| name | varchar(64) | Workspace name | |

**Note**: ID sequence starts at 1000.

---

### user_org

Alternative user-to-organization mapping.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| userId | bigint | Reference to user | NOT NULL, PRIMARY KEY, FOREIGN KEY → user(id) ON DELETE CASCADE |
| orgId | bigint | Reference to organization | NOT NULL, PRIMARY KEY, FOREIGN KEY → org(id) ON DELETE CASCADE |
| role | org_role_name | Role in organization | NOT NULL |

---

### project

Projects within workspaces.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | PRIMARY KEY |
| orgId | bigint | Reference to organization | NOT NULL, FOREIGN KEY → org(id) ON DELETE CASCADE |
| wksId | bigint | Reference to workspace | NOT NULL, FOREIGN KEY → wks(id) ON DELETE CASCADE |
| uuid | uuid | Unique identifier | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| name | varchar(64) | Project name | NOT NULL |
| cid | bigint | Creator ID | |
| ctime | timestamp with time zone | Creation timestamp | |
| mid | bigint | Modifier ID | |
| mtime | timestamp with time zone | Modification timestamp | |

**Note**: ID sequence starts at 1000.
---

### media

Media files (images and videos) with resolution information.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | PRIMARY KEY |
| orgId | bigint | Reference to organization | NOT NULL, FOREIGN KEY → org(id) ON DELETE CASCADE |
| projectId | bigint | Reference to project | NULL, FOREIGN KEY → project(id) ON DELETE CASCADE |
| uuid | uuid | Unique identifier | NOT NULL, UNIQUE, DEFAULT: gen_random_uuid() |
| type | media_type | Media type (image, video) | NOT NULL |
| name | varchar(64) | Media name | |
| srcName | varchar(64) | Source file name | |
| folderPath | varchar(256) | Folder path in storage | |
| resList | media_res[] | Available resolutions | |
| sd | media_res | Standard definition resolution | |
| cid | bigint | Creator ID | |
| ctime | timestamp with time zone | Creation timestamp | |
| mid | bigint | Modifier ID | |
| mtime | timestamp with time zone | Modification timestamp | |

**Note**: ID sequence starts at 1000. The `projectId` field has a FIXME comment indicating it may need revision.

---

### job

Background job processing for organizational tasks.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | bigserial | Primary key | PRIMARY KEY |
| orgId | bigint | Reference to organization | NOT NULL, FOREIGN KEY → org(id) ON DELETE CASCADE |
| state | job_state | Job state (new, started, completed, failed) | DEFAULT: 'new' |
| event | varchar(64) | Event identifier | NOT NULL |
| onEntity | varchar(64) | Entity type the job operates on | |
| onId | bigint | Entity ID the job operates on | |
| newTime | timestamp with time zone | When job was created | |
| startTime | timestamp with time zone | When job started processing | |
| endTime | timestamp with time zone | When job completed or failed | |
| ntd | boolean | Nothing to do flag | DEFAULT: false |
| todo | jsonb | Job task (JSON-RPC request) | |
| done | jsonb | Job result (JSON-RPC response success) | |
| progress | jsonb | Progress status array | |
| error | varchar(64) | Error code (JSON-RPC) | |
| err_msg | text | Error message | |

**Note**: ID sequence starts at 1000.

---

## Enums

### user_role

Global user roles:
- `r_sys` - System administrator
- `r_user` - Regular user

### user_access

Global user access modifiers:
- `a_ui` / `!a_ui` - Allow/Deny UI access
- `a_api` / `!a_api` - Allow/Deny API access
- `a_orgs_list` / `!a_orgs_list` - Allow/Deny listing organizations
- `a_orgs_create` / `!a_orgs_create` - Allow/Deny creating organizations
- `a_orgs_update` / `!a_orgs_update` - Allow/Deny updating organizations
- `a_orgs_delete` / `!a_orgs_delete` - Allow/Deny deleting organizations
- `a_self_profile_edit` / `!a_self_profile_edit` - Allow/Deny editing own profile

### oauth_type

OAuth provider types:
- `google` - Google OAuth
- `github` - GitHub OAuth

### org_role_name

Organization member roles:
- `org_r_owner` - Owner
- `org_r_admin` - Administrator
- `org_r_editor` - Editor
- `org_r_viewer` - Viewer

### org_access

Organization-specific access modifiers:
- `org_a_ui` / `!org_a_ui` - Allow/Deny UI access
- `org_a_api` / `!org_a_api` - Allow/Deny API access
- `org_a_orgs_list` / `!org_a_orgs_list` - Allow/Deny listing organizations
- `org_a_orgs_create` / `!org_a_orgs_create` - Allow/Deny creating organizations
- `org_a_orgs_update` / `!org_a_orgs_update` - Allow/Deny updating organizations
- `org_a_orgs_delete` / `!org_a_orgs_delete` - Allow/Deny deleting organizations
- `org_a_self_profile_edit` / `!org_a_self_profile_edit` - Allow/Deny editing own profile

### org_type

Organization types:
- `personal` - Personal organization
- `group` - Group organization

### media_type

Media file types:
- `image` - Image file
- `video` - Video file

### media_res

Media resolution options:
- `480p30` - 480p at 30fps
- `360p30` - 360p at 30fps

### job_state

Job processing states:
- `new` - Newly created job
- `started` - Job has started processing
- `completed` - Job completed successfully
- `failed` - Job failed

---

## Common Field Patterns

### Audit Fields

Most tables include these audit fields:
- `cid` - Creator ID (user who created the record)
- `ctime` - Creation timestamp
- `mid` - Modifier ID (user who last modified the record)
- `mtime` - Modification timestamp

### UUID Fields

Most entities have a `uuid` field with these properties:
- Type: `uuid`
- Constraints: `NOT NULL UNIQUE`
- Default: `gen_random_uuid()`

### Sequence Resets

Most ID sequences are set to start at 1000 to reserve IDs 1-999 for:
- Development purposes
- Testing
- Administrative purposes

---

## Database Connection

- **Database Name**: `cstar_db`
- **User**: `cstar_user`
- **Encoding**: UTF-8
