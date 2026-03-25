# Route Information

This document explains how to extract information from the browser address URL using the `route.ts` module located at `frontends/_common/src/route.ts`.

## URL Structure

The module parses URLs in the following format:

```
https://example.com/segment0/segment1/segment2?param1=value1&param2=value2#hash
```

- **Path segments**: The parts between forward slashes (`/`)
- **Query parameters**: Key-value pairs after the question mark (`?`)
- **Hash**: The fragment identifier after the hash (`#`)



## Getting Path Segments

### `pathAt(idx: number)`

Returns the path segment at a specific index (0-based).

```ts
import { pathAt } from 'frontends/_common/src/route';

// URL: /org-123/project-456/details
pathAt(0); // returns "org-123"
pathAt(1); // returns "project-456"
pathAt(2); // returns "details"
pathAt(3); // returns null (out of bounds)
```

### `paths()`

Returns an array of all path segments.

```ts
import { paths } from 'frontends/_common/src/route';

// URL: /org-123/project-456/details
paths(); // returns ["org-123", "project-456", "details"]
```

### `pathAsNum(idx: number)`

Returns the path segment at a specific index as a number.

```ts
import { pathAsNum } from 'frontends/_common/src/route';

// URL: /123/456
pathAsNum(0); // returns 123
pathAsNum(1); // returns 456
pathAsNum(2); // returns null

// URL: /abc/def
pathAsNum(0); // returns null (not a number)
```

### `getRouteOrgId()`

Convenience function to get the first path segment as a number (typically used for organization ID).

```ts
import { getRouteOrgId } from 'frontends/_common/src/route';

// URL: /123/projects
getRouteOrgId(); // returns 123
```

## Getting Query Parameters

### `param(name: string)`

Returns the value of a query parameter by name.

```ts
import { param } from 'frontends/_common/src/route';

// URL: /path?foo=bar&baz=qux
param('foo'); // returns "bar"
param('baz'); // returns "qux"
param('missing'); // returns null
```

## Getting Hash

The hash is available through the `RouteInfo` class. Access it via `getRouteInfo()`.

```ts
import { getRouteInfo } from 'frontends/_common/src/route';

// URL: /path#section1
getRouteInfo().hash(); // returns "#section1"
```

## RouteInfo Class

For more advanced usage, you can access the full `RouteInfo` object.

```ts
import { getRouteInfo } from 'frontends/_common/src/route';

const routeInfo = getRouteInfo();

// Path segments
routeInfo.pathAt(0);
routeInfo.pathAsNum(0);
routeInfo.paths();

// Query parameters
routeInfo.param('paramName');

// Hash
routeInfo.hash();
```

## Programmatic Navigation

### `pushPath(path: string)`

Navigates to a new path without reloading the page.

```ts
import { pushPath } from 'frontends/_common/src/route';

pushPath('/org-123/project-456');
```

## Example Usage

```ts
import { pathAt, pathAsNum, param, getRouteOrgId, initRoute } from 'frontends/_common/src/route';

// Initialize on app start
initRoute();

// Given URL: /123/projects/456?filter=active#section

// Get organization ID from path
const orgId = getRouteOrgId(); // 123

// Get project ID from path
const projectId = pathAsNum(2); // 456

// Get query parameter
const filter = param('filter'); // "active"

// Get hash
const hash = getRouteInfo().hash(); // "#section"

// Navigate programmatically
pushPath(`/${orgId}/projects/${projectId}`);
```

## Notes

- Path segments are 0-indexed
- Trailing slashes are automatically removed
- The route system automatically intercepts link clicks to enable SPA navigation
- Links with the `reload-link` class will bypass the route system and perform a full page reload
- Links starting with `http://` or `https://` will perform a full page load
