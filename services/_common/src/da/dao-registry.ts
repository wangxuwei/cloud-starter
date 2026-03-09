// ============================================================================
// DAO Mapping (Lazy Import to Avoid Circular Dependencies)
// ============================================================================

import { BaseDao } from "./dao-base.js";
import { orgDao, projectDao, wksDao } from "./daos.js";

/**
 * DAO registry for runtime lookup.
 * Populated dynamically to avoid circular import issues.
 */
const DAO_REGISTRY: { [name: string]: BaseDao<any, any> } = {
  wks: wksDao,
  org: orgDao,
  project: projectDao,
};

/**
 * Get DAO instance by entity key.
 * Used for nested relationship resolution.
 *
 * @param key - Entity key (e.g., 'org', 'wks', 'project')
 * @returns DAO instance or null if not found
 */
export function getDao(key: string): BaseDao<any, any> {
  return DAO_REGISTRY[key] || null;
}
