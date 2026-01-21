# Project Structure

This document describes folder organization and code distribution across the project.

## Overview

The project is organized into three main categories: `frontends`, `services`, and `shared`. Each category has a specific purpose and clear boundaries for code reuse.

## Shared Code

### shared/src/**/*.ts

Contains code shared by all services and frontends. This includes:

- **Type Definitions**: TypeScript interfaces, types, and enums used across the entire project
  - `access-types.ts` - Access control types
  - `api-types.ts` - API request/response related types
  - `entities-base.ts` - Base entity definitions
  - `entities.ts` - Entity definitions
  - `event-types.ts` - Event system types
  - `log-types.ts` - Logging types

- **TypeScript Schema**: Generated schema definitions
  - `ts-schema/` - Schema validation and generation

**Guideline**: Code in `shared` should have no external dependencies other than TypeScript itself. All services and frontends can import from this folder.

## Frontends

### frontends/_common

Contains common code used by all frontends (admin and web).

- **CSS/PCSS**: Shared styles and UI components
  - `pcss/` - Common PCSS files (typography, buttons, cards, dialogs, forms, navigation, etc.)
  - Mixins for elevations, typography, and utilities
  - UI component styles

- **Source**: Common JavaScript/TypeScript code
  - `src/common-main.ts` - Main entry point for common code, initializes DOM, loads default icons from @dom-native/ui, loads SVG symbols, triggers APP_LOADED event
  - `src/dom-utils.ts` - DOM manipulation utilities, includes `firstCssWithPrefix` to extract class names with a prefix
  - `src/global-types.ts` - Global type definitions for HTMLElement (extra, origValue properties) and Window (__version__)
  - `src/handlebars-helpers.ts` - Handlebars template helpers, includes "echo" conditional helper and "incl" template inclusion helper
  - `src/render.ts` - Rendering utilities, provides `render` and `renderAsString` functions for Handlebars templates
  - `src/route.ts` - Routing utilities, includes `RouteInfo` class, path/param extraction functions, URL change handling, and event listeners for navigation
  - `src/user-ctx.ts` - User context management, includes `UserContext` interface, login, logoff, getUserContext, and getGoogleOAuthUrl functions
  - `src/v-base.ts` - Base view/component class extending BaseHTMLElement with query caching, path change detection, and DOM element cache management
  - `src/web-request.ts` - Web request utilities, provides wrappers (webGet, webPost, webPut, webDelete, webPatch), `getData` for safe data extraction, and URL encoding

**Guideline**: Frontend-specific common code lives here. Anything that applies only to browser/frontend development belongs in this folder.

### frontends/admin

Admin interface for managing the platform.

- **CSS/PCSS**: Admin-specific styles
  - `pcss/` - Admin styles (base, colors, login view)

- **Source**: Admin application code
  - `src/main.ts` - Main entry point
  - `src/views/v-admin-login.ts` - Login view

- **Configuration**
  - `rollup.config.js` - Bundler configuration
  - `pcss.config.js` - PostCSS configuration
  - `tsconfig.json` - TypeScript configuration

### frontends/web

Main web application for users.

- **CSS/PCSS**: Web application styles
  - `pcss/` - Web styles (base, colors, dialog, views)
  - View-specific styles: home, images, videos, projects, timeline, etc.

- **Source**: Web application code
  - `src/main.ts` - Main entry point
  - `src/components/` - Reusable UI components (c-ico, c-menu)
  - `src/dialog/` - Dialog implementations (dg-base-dialog, dg-dialog)
  - `src/popup/` - Popup components (p-notif)
  - `src/views/` - Application views
    - `spec/` - Specification/design views and components
    - `timeline/` - Timeline view
    - Various views: home, login, main, media, nav, project, etc.
  - `src/dco-base.ts` - Base data component
  - `src/dcos.ts` - Data components registry
  - `src/utils.ts` - Utility functions

- **Configuration**
  - `rollup.config.js` - Bundler configuration
  - `pcss.config.js` - PostCSS configuration
  - `tsconfig.json` - TypeScript configuration

## Services

### services/_common

Contains common code shared by all backend services (admin-server, web-server, cmd, vid-init, vid-scaler). This code provides the foundational data access, security, and web infrastructure for all services.

- **Configuration**: `src/conf.ts`
  - Environment variable management and service configuration
  - Database, storage (S3/MinIO), logging, OAuth, and security settings
  - Version management and environment detection

- **Data Access (DA)**: `src/da/`
  - **Access Control**:
    - `access.ts` - `@AccessRequires` decorator for method-level access control, supports global access, org access, and entity match patterns (`@id`, `@cid`, `@userId`)
    - `access-org.ts` - Organization role management, `saveOrgRole` and `getOrgAccesses` functions
    - `access-wks.ts` - Workspace access functions (referenced)

  - **Data Access Objects (DAOs)**:
    - `dao-base.ts` - Base DAO class with CRUD operations, query building, stamping, and record processing
    - `dao-media.ts` - Media DAO with file upload handling and URL generation
    - `dao-oauth.ts` - OAuth credentials DAO for external authentication
    - `dao-org-scoped.ts` - Base DAO for org-scoped entities with automatic orgId scoping
    - `dao-org.ts` - Organization DAO with role-based access control and owner management
    - `dao-prlink.ts` - Password reset link DAO for secure password recovery
    - `dao-project.ts` - Project DAO extending org-scoped base
    - `dao-user.ts` - User DAO with credential management, password hashing, and security column filtering
    - `dao-wks.ts` - Workspace DAO extending org-scoped base
    - `daos.ts` - DAO singleton registry (userDao, orgDao, wksDao, projectDao, mediaDao, oauthDao, rplinkDao)

  - **Alternative DAO Implementations**: `daos/`
    - `dao-base.ts` - Simplified base DAO with stamping and table configuration
    - `dao-org.ts` - Simplified organization DAO with type definitions
    - `dao-user.ts` - Simplified user DAO with creation methods

  - **Database**: `db.ts`
    - Knex client factory with connection pooling
    - `knexQuery` function for creating query builders with UserContext
    - PostgreSQL type parsers for int8 and arrays
    - Performance monitoring and connection pool metrics
    - Query context tracking for logging

  - **Record Definitions**: `records/`
    - `bases.ts` - Base record interfaces: `TimestampedRec`, `OrgedRec`
    - `org-rec.ts` - Organization record with type enum (personal, shared)
    - `project-rec.ts` - Project record with name, description, and orgId
    - `user-rec.ts` - User record with credentials, roles, and security fields
    - `index.ts` - Record exports

  - **Role Management**: `role/`
    - `global.ts` - Global roles (`r_sys`, `r_user`) and accesses (web login, API, organizations, users management)
    - `org.ts` - Organization roles (`org_r_owner`, `org_r_admin`, `org_r_editor`, `org_r_viewer`, `org_r_member`) and accesses

- **Error Handling**:
  - `error.ts` - `Err` class for structured error handling, `errDic` utility for creating symbol dictionaries
  - `error-common.ts` - Common error symbols (INVALID_INPUT, APP_ERROR, CODE_ERROR, HTTP_404)

- **Event System**: `src/event/event-assert.ts`
  - Event type assertion for type-safe event handling

- **Logging**: `src/log/`
  - `logger.ts` - Public `service_log` and `web_log` functions, `ServiceLog` and `WebLog` classes
  - `log-utils.ts` - `BaseAppLog` class with Redis and file writers, S3 upload on file completion, RedStream management for Redis streams

- **Performance**: `src/perf.ts`
  - `PerfContext` class for performance tracking with hierarchical items
  - `@Monitor` decorator for automatic method performance measurement

- **Queue**: `src/queue.ts`
  - Redis stream-based queue implementation using redstream
  - `getAppQueue` and `getJobQueue` functions for typed queue access
  - Redis client factory with connection pooling and sentinel support

- **Security**: `src/security/`
  - `password-types.ts` - Password encryption interfaces (`PwdEncryptData`, `PwdCheckData`) and `PwdScheme` base class
  - `password-schemes.ts` - Password encryption schemes (basic SHA256, stronger HMAC-SHA512)
  - `password.ts` - Password encryption and checking with scheme versioning (`#E#scheme#hash` format)
  - `token.ts` - Web token management (format: `uuid.exp.sign`), token creation, validation, and expiration handling
  - `password-rlink.ts` - Password reset link generation and validation

- **Storage**: `src/store.ts`
  - S3/MinIO bucket wrapper with event streaming
  - `getCoreBucket` function for accessing the main storage bucket
  - Bucket event stream using Redis for file upload notifications

- **TypeScript Schema**: `src/ts-schema/`
  - `generated_schemas.ts` - Generated JSON schemas for entities (OrgRec, ProjectRec, UserRec, etc.)
  - `assert-schema.ts` - Type assertion functions using AJV validation
  - `index.ts` - Schema factory with caching

- **User Context**: `src/user-context.ts`
  - `UserContext` interface for request-scoped user information
  - `UserContextImpl` class with access checking (`hasAccess`, `hasOrgAccess`)
  - `newUserContext` and `getSysContext` factory functions
  - Performance context integration

- **Utilities**: `src/utils.ts`
  - Object manipulation utilities (`removeProps`)
  - Symbol dictionary creation (`symbolDic`)
  - Base64 encoding/decoding utilities
  - MIME type detection (`getMimeType`)
  - Type conversion utilities (`typify`, `typecheck`)
  - Timestamp utilities (`nowTimestamp`)
  - String formatting utilities (`formatSize`)

- **Web**: `src/web/`
  - **API Router**: `api-user-context-router.ts` - User context endpoint for frontend
  - **Authentication**: `auth-login-register-router.ts` - Login, logoff, and registration endpoints
  - **Middleware**:
    - `auth-request-mdw.ts` - Request authentication middleware using token validation
    - `auth.ts` - Token and cookie management (`AuthFailErr`, `setAuth`, `clearAuth`, `extractToken`)
    - `https-guard-mdw.ts` - HTTPS redirect and protocol guard
    - `owasp-headers-mdw.ts` - OWASP security headers (CSP, HSTS, CORS, etc.)
    - `request-wrapper-mdw.ts` - Request logging, error handling, and performance tracking
    - `static-mdw.ts` - Static file serving middleware (stub)
  - **Koa Utilities**: `koa-utils.ts`
    - Context extensions (`Ktx`, `ApiKtx`, `AppRouter`)
    - Web log record building
    - Response helpers (`success`)
  - **Koa App**: `koa-app.ts`
    - Koa application setup with middleware orchestration
    - Router mounting for auth, API, and static files
    - Proxy and cookie configuration

**Guideline**: Backend-specific common code lives here. This code is shared across all services but is not used by frontends. The data access layer provides type-safe database operations with built-in access control and performance monitoring.

### services/admin-server

Admin backend service for platform administration.

- **Source**: `src/start.ts` - Service entry point
- **Web Folder**: Built admin frontend assets served by this service

### services/web-server

Main backend service for web application.

- **Source**:
  - `src/start.ts` - Service entry point
  - `src/web/` - Web-specific routers and data source endpoints
    - `dse-generics.ts` - Generic data source endpoints
    - `dse-media.ts` - Media data source endpoints
    - `dse-org.ts` - Organization data source endpoints
    - `dse-wks.ts` - Workspace data source endpoints
    - `web-commons.ts` - Common web utilities
    - `router-auth-google-oauth.ts` - Google OAuth router

- **Tests**: `test/` - Test specifications and utilities

- **Web Folder**: Built web frontend assets served by this service

### services/cmd

Command-line interface for database and credential management. This service runs as a pod that processes batch tasks and database operations.

- **Source**:
  - `src/start.ts` - CLI entry point
  - `src/cmd-credential.ts` - Credential management commands
  - `src/cmd-db.ts` - Database management commands
  - `src/pg-utils.ts` - PostgreSQL utilities

- **SQL**: `sql/` - Database scripts
  - `00_create-db.sql` - Database creation
  - `01_create-schema.sql` - Schema creation
  - `02_seed.sql` - Seed data
  - `_drop-db.sql` - Database cleanup
  - `_reset-passwords.sql` - Password reset script

**Guideline**: The cmd service is used for administrative tasks, database migrations, and batch operations. It runs as a standalone pod when needed.

### services/vid-init

Video initialization service. Handles initialization phase of video processing.

- **Source**:
  - `src/start.ts` - Service entry point
  - `src/wkr-bridge-media-new.ts` - Media processing worker bridge

### services/vid-scaler

Video scaling/transcoding service. Handles video format conversion and scaling.

- **Source**:
  - `src/start.ts` - Service entry point
  - `src/wkr-bridge-media-mp4.ts` - MP4 processing worker bridge

### services/mock-s3

Mock S3 service for development environments. Uses MinIO/rustfs to simulate AWS S3 storage locally.

- **Configuration**: `entrypoint.sh` - Container entry point script
  - Starts the rustfs server
  - Configures MinIO client (mc) aliases
  - Sets anonymous download access for development
  - Creates buckets: `core-bucket` and `logs-bucket`

- **Kubernetes**: `k8s/dev/mock-s3.yaml` - Development deployment configuration
  - Service type: LoadBalancer
  - Ports: 9000 (S3 API), 9001 (Console)
  - Volume: HostPath mounted to `/data` for development data persistence

**Guideline**: Mock S3 is used only in development environments. Production uses AWS S3 buckets.

## Dependency Flow

```
frontends/ (admin, web)
    ↓
frontends/_common
    ↓
shared/src
    ↑
services/_common
    ↓
services/* (admin-server, web-server, cmd, vid-init, vid-scaler)
```

- `shared/src` is the lowest-level dependency - no service or frontend depends on it, but all can use it
- `frontends/_common` provides shared frontend functionality to admin and web frontends
- `services/_common` provides shared backend functionality to all services
- Services do not share code with frontends except through `shared/src`

## Naming Conventions

- All file and folder names use lowercase with hyphens for multi-word names
- TypeScript files use `.ts` extension
- CSS files use `.pcss` extension (PostCSS)
- Configuration files use descriptive names with `.config.js` extension
- Test files use `.spec.ts` extension
- SQL files use numeric prefixes for execution order (00_, 01_, 02_)

## Development Guidelines

1. **Shared Code**: Place code in `shared/src` only if it has no external dependencies
2. **Frontend Common**: Place frontend-specific shared code in `frontends/_common`
3. **Service Common**: Place backend-specific shared code in `services/_common`
4. **Service Isolation**: Each service should be independently deployable and testable
5. **Database Operations**: Use `cmd` service for database migrations and administrative tasks
6. **Development Storage**: Use `mock-s3` for local development S3 simulation
7. **Production Storage**: Use AWS S3 buckets in production environments
8. **Access Control**: Use `@AccessRequires` decorator on DAO methods for fine-grained access control
9. **Performance**: Use `@Monitor` decorator on DAO methods for automatic performance tracking
10. **Security**: Password encryption uses scheme versioning for future migration support
