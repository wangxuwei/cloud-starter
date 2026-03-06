import { BaseDao } from './dao-base.js';
import { MediaDao } from './dao-media.js';
import { OAuthDao } from './dao-oauth.js';
import { OrgDao } from './dao-org.js';
import { PrlinkDao } from './dao-prlink.js';
import { ProjectDao } from './dao-project.js';
import { UserDao } from './dao-user.js';
import { WksDao } from './dao-wks.js';

export const userDao = new UserDao();

export const orgDao = new OrgDao();

export const wksDao = new WksDao();

export const projectDao = new ProjectDao();

export const mediaDao = new MediaDao();

export const oauthDao = new OAuthDao();

export const rplinkDao = new PrlinkDao();



// ============================================================================
// DAO Mapping (Lazy Import to Avoid Circular Dependencies)
// ============================================================================

/**
 * DAO registry for runtime lookup.
 * Populated dynamically to avoid circular import issues.
 */
const DAO_REGISTRY:{[name:string]: BaseDao<any, any>} = {
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
