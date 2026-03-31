

-- #region:    --- User

-- Global user roles
CREATE TYPE user_role AS ENUM (
  'r_sys',
  'r_admin',
  'r_user'
);

-- user access modifiers, with their negatives
CREATE TYPE user_access AS ENUM (
  'a_ui',
  '!a_ui',
  'a_api',
  '!a_api',
  'a_orgs_list',
  '!a_orgs_list',
  'a_orgs_create',
  '!a_orgs_create',
  'a_orgs_update',
  '!a_orgs_update',    
  'a_orgs_delete',
  '!a_orgs_delete',    
  'a_self_profile_edit',
  '!a_self_profile_edit'
);

CREATE TABLE "user" (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid (),
  username varchar(64) NOT NULL UNIQUE,
  "fullName" varchar(92),

  -- global roles
  ROLE user_role NOT NULL DEFAULT 'r_user',
  -- access modifiers
  accesses user_access[],

  -- password salt for password encryption
  pwd varchar(128),
  psalt uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "pwdHistory" varchar(128)[],

  -- token salt for session cookie
  tsalt uuid NOT NULL UNIQUE DEFAULT gen_random_uuid (),

  -- timestamps
  cid bigint,
  ctime timestamp with time zone,
  mid bigint,
  mtime timestamp with time zone
);
-- reserving for 1000 for dev, test, and administrative purproses.
ALTER SEQUENCE user_id_seq
  RESTART WITH 1000;


-- password reset link
CREATE TABLE "prlink" (
  id bigserial,
  "userId" bigint NOT NULL UNIQUE,
  code uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "clickFirst" timestamp with time zone,
  "clickLast" timestamp with time zone,
  "clickCount" int,

  FOREIGN KEY ("userId") REFERENCES "user" (id) ON DELETE CASCADE
);
-- #endregion: --- User

-- #region:    --- OAuth
CREATE TYPE oauth_type AS ENUM (
  'google',
  'github'
);

CREATE TABLE oauth (
  id bigserial PRIMARY KEY,
  TYPE oauth_type NOT NULL DEFAULT 'google',
  "userId" bigint NOT NULL,
  oauth_id varchar(128),
  oauth_name varchar(64),
  oauth_username varchar(64),
  oauth_token varchar(256),
  oauth_picture varchar(128),
  -- timestamps 
  cid bigint,
  ctime timestamp with time zone,  
  mid bigint,
  mtime timestamp with time zone,
  -- rels    
  FOREIGN KEY ("userId") REFERENCES "user" (id) ON DELETE CASCADE
);

ALTER SEQUENCE oauth_id_seq
  RESTART WITH 1000;
-- #endregion: --- OAuth


-- #region:    --- Org
CREATE TYPE org_role_name AS ENUM (
  'org_r_owner',
  'org_r_admin',
  'org_r_editor',
  'org_r_viewer'
);

CREATE TYPE org_access AS ENUM (
  'org_a_ui',
  '!org_a_ui',
  'org_a_api',
  '!org_a_api',
  'org_a_orgs_list',
  '!org_a_orgs_list',
  'org_a_orgs_create',
  '!org_a_orgs_create',
  'org_a_orgs_update',
  '!org_a_orgs_update',    
  'org_a_orgs_delete',
  '!org_a_orgs_delete',    
  'org_a_self_profile_edit',
  '!org_a_self_profile_edit'
);


CREATE TYPE org_type AS ENUM (
  'personal',
  'group'
);

CREATE TABLE "org" (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  type org_type NOT NULL DEFAULT 'personal',
  name varchar(64), 

  -- timestamps 
  cid bigint,
  ctime timestamp with time zone,  
  mid bigint,
  mtime timestamp with time zone
);
ALTER SEQUENCE org_id_seq
  RESTART WITH 1000;
-- #endregion: --- Org


CREATE TABLE "wks" (
  id bigserial PRIMARY KEY,
  uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid (),
  "orgId" bigint NOT NULL,
  cid bigint,
  ctime timestamp with time zone,
  mid bigint,
  mtime timestamp with time zone,
  name varchar(64),

  FOREIGN KEY ("orgId") REFERENCES "org" (id) ON DELETE CASCADE
);

ALTER SEQUENCE wks_id_seq
  RESTART WITH 1000;

CREATE TABLE "user_org" (
  "userId" bigint NOT NULL,
  "orgId" bigint NOT NULL,
  "role" org_role_name NOT NULL,
  PRIMARY KEY ("userId", "orgId"),
  FOREIGN KEY ("userId") REFERENCES "user" (id) ON DELETE CASCADE,
  FOREIGN KEY ("orgId") REFERENCES "org" (id) ON DELETE CASCADE
);


-- #region:    --- Project
CREATE TABLE "project" (
  id bigserial PRIMARY KEY,
  "orgId" bigint NOT NULL,  
  "wksId" bigint NOT NULL,  
  uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid (),
  name varchar(64) NOT NULL ,

  -- timestamps 
  cid bigint,
  ctime timestamp with time zone,
  mid bigint,
  mtime timestamp with time zone,

  FOREIGN KEY ("wksId") REFERENCES "wks" (id) ON DELETE CASCADE,
  FOREIGN KEY ("orgId") REFERENCES "org" (id) ON DELETE CASCADE
);

ALTER SEQUENCE project_id_seq
  RESTART WITH 1000;
-- #endregion: --- Project


-- #region:    --- Asset
CREATE TYPE asset_type AS ENUM (
  'image',
  'video'
);

CREATE TYPE asset_res AS ENUM (
  '480p30',
  '360p30'
);

CREATE TABLE "asset" (
  id bigserial PRIMARY KEY,
  "orgId" bigint NOT NULL,
  "projectId" bigint NULL, -- FIXME
  uuid uuid NOT NULL UNIQUE DEFAULT gen_random_uuid (),
  type asset_type NOT NULL,
  name varchar(64),

  "srcName" varchar(64),
  "folderPath" varchar(256),

  "resList" asset_res[], -- available res list

  sd asset_res, -- the low definition suffix like '480p60' (must be available in s3)

  -- timestamps 
  cid bigint,
  ctime timestamp with time zone,
  mid bigint,
  mtime timestamp with time zone,

  -- rels
  FOREIGN KEY ("orgId") REFERENCES "org" (id) ON DELETE CASCADE,
  FOREIGN KEY ("projectId") REFERENCES "project" (id) ON DELETE CASCADE
);

ALTER SEQUENCE asset_id_seq
  RESTART WITH 1000;


-- #endregion: --- Asset

-- #region:    --- Job
CREATE TYPE job_state AS ENUM (
  'new',
  'started',
  'completed',
  'failed'
);

-- org jobs only (orgId must be true)
CREATE TABLE "job" (

  id bigserial PRIMARY KEY,
  "orgId" bigint NOT NULL,
  state job_state DEFAULT 'new',

  event varchar(64) NOT NULL,

  "onEntity" varchar(64),
  "onId" bigint,

  "newTime" timestamp with time zone,
  "startTime" timestamp with time zone, -- when start processing
  "endTime" timestamp with time zone, -- for completed or failed

  "ntd" boolean DEFAULT false, -- nothing to do
  
  todo jsonb, -- could/should be json-rpc request
  done jsonb, -- could/should be json-rpc response success
  progress jsonb, -- could/should be array of statuses

  error varchar(64), -- should/should be json-rpc 
  err_msg text,
  
  FOREIGN KEY ("orgId") REFERENCES "org" (id) ON DELETE CASCADE
);

ALTER SEQUENCE job_id_seq
  RESTART WITH 1000;
-- #endregion: --- Job



