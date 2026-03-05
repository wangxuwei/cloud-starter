/**
 * Centralized include schema for JOQL $include functionality
 * 
 * This module provides a single source of truth for all entity relationships,
 * include columns, and DAO mappings. It eliminates duplication by defining
 * relationships once and referencing them from multiple entities.
 * 
 * Architecture:
 * 1. Relationship definitions: Direct database relationships with foreign key details
 * 2. Include columns: Default columns, all columns, column groups for each entity
 * 3. Relationship configurations: Reference relationship definitions with type and target
 * 4. DAO mapping: Runtime DAO lookup by entity key
 */


// ============================================================================
// Types
// ============================================================================

/**
 * Direct database relationship definition.
 * Represents a relationship as it exists in the database schema.
 * Defined once and referenced by multiple entities to avoid duplication.
 */
export interface RelationshipDef {
	/** Source table for this relationship */
	fromTable: string;
	/** Target table for this relationship */
	toTable: string;
	/** Relationship type from the perspective of fromTable */
	type: RelationshipType;
	/** Foreign key column name (location depends on relationship type) */
	foreignKey: string;
	/** Primary key column on target table (defaults to 'id') */
	targetKey?: string;
}

/**
 * Include columns for an entity.
 * Defines what columns and column groups can be included for this entity.
 */
export interface EntityIncludeColumnsSpec {
	/** Default columns (e.g., id, name) */
	defaultColumns: string[];
	/** All columns available for this entity */
	allColumns: string[];
	/** Column groups (e.g., _defaults, _timestamps, _stamped) */
	columnGroups: Record<string, string[]>;
	/** Whether this entity has audit columns (cid, ctime, mid, mtime) */
	stamped: boolean;
}

/**
 * Simplified include relation specification.
 * - `true` indicates a relationship that should be auto-resolved from RELATIONSHIP_DEFS
 * - Object with nested relationships for deeper includes
 */
export interface IncludeRelationSpec {
  [key: string]: boolean | IncludeRelationSpec;
}

/**
 * Schema containing all entity definitions.
 * The complete registry for include processing.
 */
export interface IncludeSchema {
	/** Direct relationship definitions (database schema) */
	relationships: Record<string, RelationshipDef>;
	/** Include columns for each entity */
	entityIncludeColumns: Record<string, EntityIncludeColumnsSpec>;
	/** Include specifications for each entity (simplified format) */
	entityIncludeRelations: IncludeRelationSpec;
}


/**
 * Relationship type for entity relationships.
 * - 'belongsTo': Many-to-one relationship (foreign key on this entity)
 * - 'hasMany': One-to-many relationship (foreign key on related entity)
 * - 'hasOne': One-to-one relationship (foreign key on related entity)
 */
export type RelationshipType = 'belongsTo' | 'hasMany' | 'hasOne';

// ============================================================================
// Relationship Definitions (Direct Database Relationships)
// ============================================================================

/**
 * Direct relationships as defined in the database schema.
 * Each relationship is defined once from the perspective of the "from" entity.
 * - hasMany: FK on target table
 * - belongsTo: FK on source table
 * - hasOne: FK on target table
 */
const RELATIONSHIP_DEFS: Record<string, RelationshipDef> = {
	// org -> wks (one-to-many): FK on wks table
	org_to_wks: {
		fromTable: 'org',
		toTable: 'wks',
		type: 'hasMany',
		foreignKey: 'orgId',
		targetKey: 'id'
	},

	// wks -> org (many-to-one): FK on wks table (reverse perspective of org_to_wks)
	wks_to_org: {
		fromTable: 'wks',
		toTable: 'org',
		type: 'belongsTo',
		foreignKey: 'orgId',
		targetKey: 'id'
	},

	// wks -> project (one-to-many): FK on project table
	wks_to_project: {
		fromTable: 'wks',
		toTable: 'project',
		type: 'hasMany',
		foreignKey: 'wksId',
		targetKey: 'id'
	},

	// project -> wks (many-to-one): FK on project table (reverse perspective of wks_to_project)
	project_to_wks: {
		fromTable: 'project',
		toTable: 'wks',
		type: 'belongsTo',
		foreignKey: 'wksId',
		targetKey: 'id'
	}
};

// ============================================================================
// Entity Include columns spec
// ============================================================================
const ENTITY_COLUMN_SPECS: Record<string, EntityIncludeColumnsSpec> = {
	org: {
		defaultColumns: ['id', 'name'],
		allColumns: ['id', 'cid', 'ctime', 'mid', 'mtime', 'name'],
		columnGroups: {
			_defaults: ['id', 'name'],
			_stamped: ['id', 'cid', 'ctime', 'mid', 'mtime', 'name'],
			_timestamps: ['cid', 'ctime', 'mid', 'mtime']
		},
		stamped: true
	},
	wks: {
		defaultColumns: ['id', 'name'],
		allColumns: ['id', 'cid', 'ctime', 'mid', 'mtime', 'name'],
		columnGroups: {
			_defaults: ['id', 'name'],
			_stamped: ['id', 'cid', 'ctime', 'mid', 'mtime', 'name'],
			_timestamps: ['cid', 'ctime', 'mid', 'mtime']
		},
		stamped: true
	},
	project: {
		defaultColumns: ['id', 'name'],
		allColumns: ['id', 'cid', 'ctime', 'mid', 'mtime', 'name', 'wksId'],
		columnGroups: {
			_defaults: ['id', 'name'],
			_details: ['id', 'name', 'wksId'],
			_stamped: ['id', 'cid', 'ctime', 'mid', 'mtime', 'name', 'wksId'],
			_timestamps: ['cid', 'ctime', 'mid', 'mtime']
		},
		stamped: true
	}
};

// ============================================================================
// Entity Include Relation Specifications (Simplified Format)
// ============================================================================

/**
 * Simplified include relation specifications.
 * - `true` means: resolve this relationship automatically from RELATIONSHIP_DEFS
 * - Object with nested keys means: nested relationships (e.g., { org: true })
 * 
 * Relationship details (type, foreignKey, targetKeyCol) are auto-resolved from
 * RELATIONSHIP_DEFS based on the entityKey and relationKey pattern: ${entityKey}_${relationKey}
 */
const ENTITY_INCLUDE_RELATION_SPECS: Record<string, IncludeRelationSpec> = {
	org: {
		wks: true,
	},
	wks: {
		project: true,
		org: true
	} ,
	project: {
		wks: {
      org: true
    }
	}
};

// ============================================================================
// Complete Schema
// ============================================================================

/**
 * The complete include schema.
 * Single source of truth for all include-related configuration.
 */
export const INCLUDE_SCHEMA: IncludeSchema = {
	relationships: RELATIONSHIP_DEFS,
	entityIncludeColumns: ENTITY_COLUMN_SPECS,
	entityIncludeRelations: ENTITY_INCLUDE_RELATION_SPECS
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get include Columns for an entity.
 * 
 * @param key - Entity key
 * @returns Entity include Columns
 */
export function getEntityIncludeColumns(key: string): EntityIncludeColumnsSpec {
	const caps = ENTITY_COLUMN_SPECS[key];
	if (!caps) {
		throw new Error(`No include columns found for entity '${key}'`);
	}
	return caps;
}

/**
 * Get include specification for an entity.
 * 
 * @param key - Entity key
 * @returns Entity include specification
 */
export function getEntityIncludeRelations(key: string): IncludeRelationSpec {
	const includes = ENTITY_INCLUDE_RELATION_SPECS[key];
	if (!includes) {
		throw new Error(`No include relation specification found for entity '${key}'`);
	}
	return includes;
}

/**
 * Get relationship definition by key.
 * 
 * @param key - Relationship key (e.g., 'org_to_wks')
 * @returns Relationship definition
 */
export function getRelationship(key: string, key1: string): RelationshipDef {
	const keyRel = `${key}_to_${key1}`;
	const rel = RELATIONSHIP_DEFS[keyRel];
	if (!rel) {
		throw new Error(`No relationship found with key '${keyRel}'`);
	}
	return rel;
}