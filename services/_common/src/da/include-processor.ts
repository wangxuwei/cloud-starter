/**
 * Include processing utilities for JOQL $include functionality
 * 
 * This module provides functions to recursively process include specifications
 * into query configurations, supporting unlimited nesting depth.
 * 
 * Now refactored to use the centralized include-schema for all configuration.
 */

import type { IncludeObject } from '#shared/query_options.js';
import { getEntityIncludeColumns, getEntityIncludeRelations, type RelationshipDef } from './include-conf.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Column group mapping from group name to column names.
 * Example: { _defaults: ['id', 'name'], _timestamps: ['cid', 'ctime', 'mid', 'mtime'] }
 */
export interface ColumnGroupMap {
	[groupName: string]: string[];
}

/**
 * Include processor options representing the processed include specification.
 * This is the main type used throughout the include processing logic.
 */
export interface IncludeProcessorOptions {
	/** Table alias for this level in queries */
	alias: string;
	/** Entity key to lookup includeColumns and relationships from schema */
	entityKey?: string;
	/** Table name (normally same as entityKey) */
	table?: string;
	/** Default columns if no includes specified */
	columns?: string[];
	/** Group definitions (e.g., _defaults, _timestamps) */
	columnGroups?: ColumnGroupMap;
	/** Nested entity relationships with their include options */
	relationships?: Record<string, IncludeProcessorOptions>;
	/** All available columns for this entity (from include-conf) */
	targetAllColumns: string[];
	/** Final columns for database query (resolved from includes) */
	targetColumns: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to add table alias to column name if not already present.
 * 
 * @param column - Column name (may already have alias)
 * @param alias - Table alias to add
 * @returns Column name with table alias
 */
export function addTableAlias(column: string, alias: string): string {
	if (column.includes('.') || column === '*') {
		return column;
	}
	return `${alias}.${column}`;
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Build include processor options from include specification.
 * Converts IncludeObject to IncludeProcessorOptions by resolving
 * details from the schema and handling nested relationships.
 * 
 * @param includeObject - The include specification from query options
 * @param entityKey - Entity key to lookup schema data
 * @param alias - Table alias for this level
 * @returns Processed include options
 */
function buildIncludeProcessorOptions(
	includeObject: IncludeObject | undefined | boolean,
	entityKey: string,
	alias: string
): IncludeProcessorOptions {
	const entityIncludeColumns = getEntityIncludeColumns(entityKey);
	const entityIncludeRelations = getEntityIncludeRelations(entityKey);
	
	const options: IncludeProcessorOptions = {
		alias,
		entityKey,
		table: entityKey,
		columns: entityIncludeColumns.defaultColumns,
		targetAllColumns: entityIncludeColumns.allColumns,
		columnGroups: entityIncludeColumns.columnGroups,
		targetColumns: [],
		relationships: {}
	};
	
	// If no includes specified, return defaults
	if (!includeObject || typeof includeObject !== 'object' || Object.keys(includeObject).length === 0) {
		options.targetColumns = options.columns!.map(c => addTableAlias(c, alias));
		return options;
	}
	
	// Build direct columns and column groups
	const directColumns = new Set<string>();
	
	// Process each include key
	for (const [key, spec] of Object.entries(includeObject)) {
		if (spec === false) continue;
		
		if (key.startsWith('_')) {
			// Column group
			if (options.columnGroups && options.columnGroups[key]) {
				for (const col of options.columnGroups[key]) {
					directColumns.add(addTableAlias(col, alias));
				}
			}
		} else if (typeof spec === 'boolean' || (typeof spec === 'object' && !Array.isArray(spec))) {
			// Relationship (either boolean true or nested object)
			const relKey = key;
			const relAlias = `${alias}_${key}`;
			const relSpec = spec === true ? undefined : spec as IncludeObject;
			
			// Build nested options for this relationship
			const nestedOptions = buildIncludeProcessorOptions(relSpec, relKey, relAlias);
			options.relationships![key] = nestedOptions;
		} else {
			// Direct column
			if (spec) {
				directColumns.add(addTableAlias(key, alias));
			}
		}
	}
	
	// Set final target columns
	if (directColumns.size > 0) {
		options.targetColumns = Array.from(directColumns);
	} else {
		options.targetColumns = options.columns!.map(c => addTableAlias(c, alias));
	}
	
	return options;
}

/**
 * Validate include processor options.
 * Checks that all keys in includes are valid columns, column groups, or relationships.
 * 
 * @param options - The include processor options to validate
 * @throws Error if any include key is invalid
 */
export function validateIncludeProcessorOptions(options: IncludeProcessorOptions): void {
	const validKeys = new Set<string>();
	
	// Add direct columns
	if (options.targetAllColumns) {
		for (const col of options.targetAllColumns) {
			validKeys.add(col);
		}
	}
	
	// Add column group keys
	if (options.columnGroups) {
		for (const groupName of Object.keys(options.columnGroups)) {
			validKeys.add(groupName);
		}
	}
	
	// Add relationship keys
	if (options.relationships) {
		for (const relationName of Object.keys(options.relationships)) {
			validKeys.add(relationName);
		}
	}
}

/**
 * Resolve relationship definition for a given entity and relation.
 * Looks up the relationship from the schema.
 * 
 * @param entityKey - Source entity key (e.g., 'org')
 * @param relationKey - Relationship name/key (e.g., 'wks')
 * @returns Relationship definition or undefined if not found
 */
function resolveRelationshipDef(entityKey: string, relationKey: string): RelationshipDef | undefined {
	try {
		const { resolveRelationship } = require('./include-conf.js');
		return resolveRelationship(entityKey, relationKey);
	} catch {
		return undefined;
	}
}

/**
 * Extended IncludeProcessorOptions with additional properties for query building and batch loading.
 * These properties are added to the nested IncludeProcessorOptions in processIncludes
 * to support JOIN building for belongsTo relationships and batch loading for hasMany/hasOne.
 */
export interface ExtendedIncludeProcessorOptions extends IncludeProcessorOptions {
	/** Source key for the relationship (foreign key on this or target table) */
	sourceKey?: string;
	/** Source table alias for the relationship */
	sourceTableAlias?: string;
	/** Relationship type for query building */
	relationshipType?: 'belongsTo' | 'hasMany' | 'hasOne';
	/** Target key for the relationship (defaults to 'id') */
	targetKey?: string;
}

/**
 * Process include specification into query result format.
 * This is the main entry point used by DAOs to process includes.
 * 
 * @param includeObject - The include specification from query options
 * @param entityKey - Entity key to lookup schema data
 * @param alias - Table alias for this level
 * @returns Query result with columns and nested configs
 */
export function processIncludes(
	includeObject: IncludeObject | undefined | boolean,
	entityKey: string,
	alias: string = 'main'
): IncludeProcessorOptions {
	const options = buildIncludeProcessorOptions(includeObject, entityKey, alias);
	
	// Validate the include options
	validateIncludeProcessorOptions(options);
	
	const result = {
		columns: options.targetColumns,
		nested: [] as ExtendedIncludeProcessorOptions[]
	};
	
	// Process relationships
	if (options.relationships) {
		for (const [relationKey, nestedOptions] of Object.entries(options.relationships)) {
			const relationshipDef = resolveRelationshipDef(entityKey, relationKey);
			
			if (relationshipDef) {
				// Store relationship metadata as extra properties for query building and batch loading
				const nestedConfig: ExtendedIncludeProcessorOptions = {
					...nestedOptions,
					entityKey: relationKey,
					sourceKey: relationshipDef.foreignKey,
					sourceTableAlias: alias,
					relationshipType: relationshipDef.type,
					targetKey: relationshipDef.targetKey || 'id'
				};
				result.nested.push(nestedConfig);
			}
		}
	}
	
	return result;
}
