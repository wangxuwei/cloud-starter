/**
 * Include processing utilities for JOQL $include functionality
 * 
 * This module provides functions to recursively process include specifications
 * into Knex query configurations, supporting unlimited nesting depth and proper
 * SQL generation through Knex query builder (not raw SQL).
 */

import type { IncludeObject, RelationshipConfig } from '#shared/query_options.js';

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
 * Options for include processing at a specific level.
 */
export interface IncludeProcessorOptions {
	columns?: string[]; // Default columns if no includes specified
	allColumns?: string[]; // All available columns for validation
	columnGroups?: ColumnGroupMap; // Group definitions (e.g., _defaults, _timestamps)
	stamped?: boolean; // Auto-add audit columns (cid, ctime, mid, mtime)
	relationships?: Record<string, RelationshipConfig>; // Nested entity relationships
	tableAlias?: string; // Table alias for this level (for column prefixing)
}

/**
 * Result of include processing - provides configuration for Knex query builder.
 */
export interface IncludeProcessResult {
	columns: string[]; // Columns to select with table aliases
	joins: JoinClause[]; // JOIN configurations for Knex query builder
	nested: NestedIncludeConfig[]; // Nested includes for batch loading (hasMany/hasOne)
 
 /**
  * Flag indicating whether main table columns (without table aliases) are selected.
  * This excludes columns from joined tables which have table aliases.
  */
 hasMainColumns: boolean;
}

/**
 * JOIN clause configuration for Knex.
 */
export interface JoinClause {
	type: 'LEFT' | 'INNER';
	table: string;
	as: string;
	on: { first: string; operator: string; second: string }; // ON condition parts
	prefix?: string; // Prefix for column aliases to avoid name conflicts (e.g., 'wks_' for workspace.id -> wks_id)
}

/**
 * Configuration for nested batch loading (hasMany/hasOne relationships).
 */
export interface NestedIncludeConfig {
	relation: string;
	config: RelationshipConfig;
	includes: IncludeObject;
	sourceKey: string; // Key from parent to link children
	tableAlias: string;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validates a relationship configuration for required properties based on type.
 * 
 * @param relationName - Name of the relationship being validated
 * @param config - Relationship configuration to validate
 * @throws Error if required properties are missing
 */
export function validateRelationshipConfig(relationName: string, config: RelationshipConfig): void {
	// Common required fields for all relationship types
	if (!config.type) {
		throw new Error(`Relationship '${relationName}' is missing required property 'type'`);
	}
	if (!config.targetTable) {
		throw new Error(`Relationship '${relationName}' is missing required property 'targetTable'`);
	}
	if (!config.foreignKey) {
		throw new Error(`Relationship '${relationName}' is missing required property 'foreignKey'`);
	}

	// Validate relationship type is supported
	const supportedTypes = ['belongsTo', 'hasMany', 'hasOne'];
	if (!supportedTypes.includes(config.type)) {
		throw new Error(`Relationship '${relationName}' has unsupported type '${config.type}'. Supported types are: ${supportedTypes.join(', ')}`);
	}

	// For belongsTo, targetKey defaults to 'id' if not specified
	// For hasMany and hasOne, foreignKey is on the target table
}

/**
 * Validates include keys against available columns, groups, and relationships.
 * Recursively validates nested includes for relationships.
 * Throws an error if any include key is not recognized.
 * 
 * @param includes - The include specification to validate
 * @param options - Include processor options containing available columns, groups, and relationships
 * @param path - Current path in the include tree (for error messages)
 * @throws Error if an include key doesn't match any available column, group, or relationship
 */
export function validateIncludes(
	includes: IncludeObject | undefined | boolean,
	options: IncludeProcessorOptions,
	path: string = ''
): void {
	if (!includes || typeof includes !== 'object') {
		return;
	}

	const { columnGroups = {}, relationships = {}, allColumns } = options;
	// Build a set of all valid top-level keys
	const validKeys = new Set<string>();
	// Add direct columns
	if (allColumns) {
		for (const col of allColumns) {
			validKeys.add(col);
		}
	}

	// Add column group keys
	for (const groupName of Object.keys(columnGroups)) {
		validKeys.add(groupName);
	}

	// Add stamped columns if stamped option is enabled
	if (options.stamped) {
		validKeys.add('cid');
		validKeys.add('ctime');
		validKeys.add('mid');
		validKeys.add('mtime');
	}

	// Add relationship keys
	for (const relationName of Object.keys(relationships)) {
		validKeys.add(relationName);
	}

	// Validate each include key
	for (const key of Object.keys(includes)) {
		const fullPath = path ? `${path}.${key}` : key;
		const spec = includes[key];

		// Handle nested entity includes (belongsTo, hasMany, hasOne)
		// Check if key is a relationship and spec is an object (not boolean)
		if (!key.startsWith('_') && relationships[key] && typeof spec === 'object' && !Array.isArray(spec)) {
			// Validate relationship configuration
			validateRelationshipConfig(key, relationships[key]);

			// Recursively validate nested includes if they exist
			const relationship = relationships[key];
			
			// Build options for nested validation
			const nestedOptions: IncludeProcessorOptions = {
				allColumns: relationship.targetAllColumns,
				columns: relationship.targetColumns,
				columnGroups: relationship.targetColumnGroups,
				stamped: relationship.targetStamped,
				relationships: {}, // Nested relationships would need to be defined in relationship config
				tableAlias: relationship.as || key
			};

			// Only validate recursively if spec is a non-empty object
			// Empty object {} is valid and means "use defaults"
			if (Object.keys(spec).length > 0) {
				validateIncludes(spec as IncludeObject, nestedOptions, fullPath);
			}
		}
		// Validate against available keys (columns, groups, stamped columns, relationships)
		else if (!validKeys.has(key)) {
			const availableKeys = Array.from(validKeys).sort().join(', ');
			throw new Error(`Include key '${fullPath}' is not valid. Available keys are: ${availableKeys}`);
		}
	}
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Recursively processes include specifications into Knex query configuration.
 * All SQL construction happens through Knex query builder, not raw SQL.
 * 
 * @param includes - The include specification from query options
 * @param options - Include processor options for this level
 * @param path - Current path in the include tree (for alias generation)
 * @param sourceAlias - Source table alias for JOIN generation
 * @returns Query configuration with columns, joins, and nested configs
 */
export function processIncludes(
	includes: IncludeObject | undefined | boolean,
	options: IncludeProcessorOptions,
	path: string = '',
	sourceAlias: string = 'main'
): IncludeProcessResult {
	// Validate includes before processing
	validateIncludes(includes, options);

	const {
		columns: defaultColumns,
		columnGroups = {},
		stamped = false,
		relationships = {},
		tableAlias = sourceAlias
	} = options;

	const selectedColumns = new Set<string>();
	const joins: JoinClause[] = [];
	const nested: NestedIncludeConfig[] = [];
 	let hasMainColumns = false;

	// If no includes specified, use default columns or all columns
	if (!includes || typeof includes !== 'object' || Object.keys(includes).length === 0) {
		const cols = defaultColumns || ['*'];
		return {
			columns: cols.map(c => addTableAlias(c, tableAlias)),
			joins: [],
			nested: [],
			hasMainColumns: true
		};
	}

	// Process each include key
	for (const [key, spec] of Object.entries(includes)) {
		if (spec === false) continue; // Explicit exclusion

		// Handle nested entity includes (belongsTo, hasMany, hasOne)
		if (typeof spec === 'object' && !key.startsWith('_')) {
			const relationship = relationships[key];

			if (relationship) {
				// Validate relationship configuration before processing
				validateRelationshipConfig(key, relationship);

				const alias = relationship.as || key;
				const fullPath = path ? `${path}.${key}` : key;

				if (relationship.type === 'belongsTo') {
					// For belongsTo, create a JOIN configuration for Knex leftJoin()
					// foreignKey is on the source table (this entity)
					const targetKey = relationship.targetKey || 'id';

					// Build ON condition as object for Knex
					const onClause = {
						first: `${tableAlias}.${relationship.foreignKey}`,
						operator: '=',
						second: `${alias}.${targetKey}`
					};

					// Generate prefix for column aliases to avoid name conflicts
					// e.g., workspace table -> 'workspace_' prefix, so workspace.id -> workspace_id
					const prefix = `${key}_`;

					joins.push({
						type: 'LEFT',
						table: relationship.targetTable,
						as: alias,
						on: onClause,
						prefix
					});

					nested.push({
						relation: key,
						config: relationship,
						includes: spec as IncludeObject,
						sourceKey: relationship.foreignKey,
						tableAlias
					});

					// Recursively process nested includes
					// Empty object {} means select default columns for nested entity
					const nestedIncludes = (spec as IncludeObject);
					
					const targetOptions: IncludeProcessorOptions = {
						allColumns: relationship.targetAllColumns,
						columns: relationship.targetColumns,
						columnGroups: relationship.targetColumnGroups,
						stamped: relationship.targetStamped,
						tableAlias: alias
					};

					// Pass spec directly so empty object {} triggers default column selection
					const nestedResult = processIncludes(
						nestedIncludes,
						targetOptions,
						fullPath,
						alias
					);

					// Add nested columns and joins
					nestedResult.columns.forEach(col => selectedColumns.add(col));
					joins.push(...nestedResult.joins);
					nested.push(...nestedResult.nested);
				} else if (relationship.type === 'hasMany' || relationship.type === 'hasOne') {
					// For hasMany/hasOne, defer to batch loading
					// foreignKey is on the target table pointing to this entity
					nested.push({
						relation: key,
						config: relationship,
						includes: spec as IncludeObject,
						sourceKey: relationship.foreignKey,
						tableAlias
					});
				}
			} else {
				// No relationship found for this key, check if it's a group or column
				if (!key.startsWith('_') && !columnGroups[key]) {
					// Not a relationship, not a group, assume it's a direct column include
					if (spec) {
						selectedColumns.add(addTableAlias(key, tableAlias));
					}
				}
			}
		}
		// Handle group includes (e.g., _defaults, _timestamps)
		else if (key.startsWith('_') && columnGroups[key]) {
			for (const col of columnGroups[key]) {
				selectedColumns.add(addTableAlias(col, tableAlias));
			}
			hasMainColumns = true;
			// Add stamped columns if stamped option is enabled and group includes timestamps
			if (stamped && key === '_timestamps') {
				['cid', 'ctime', 'mid', 'mtime'].forEach(col => {
					selectedColumns.add(addTableAlias(col, tableAlias));
				});
			}
		}
		// Handle direct column includes
		else if (spec === true) {
			selectedColumns.add(addTableAlias(key, tableAlias));
			hasMainColumns = true;
		}
	}

	// If no columns selected, fallback to defaults
	if (selectedColumns.size === 0) {
		const cols = defaultColumns || ['*'];
		cols.forEach(col => selectedColumns.add(addTableAlias(col, tableAlias)));
		hasMainColumns = true;
	}

	return {
		columns: Array.from(selectedColumns),
		joins,
		nested,
		hasMainColumns
	};
}

/**
 * Builds default column groups for stamped entities.
 * 
 * @param baseColumns - Base columns for the entity (e.g., ['id', 'name'])
 * @param stamped - Whether the entity has audit columns
 * @returns Column group map with _defaults, _timestamps (if stamped), and _stamped (if stamped)
 */
export function buildDefaultGroups(
	baseColumns: string[],
	stamped: boolean = false
): ColumnGroupMap {
	const groups: ColumnGroupMap = {
		_defaults: baseColumns,
	};

	if (stamped) {
		groups._timestamps = ['cid', 'ctime', 'mid', 'mtime'];
		groups._stamped = [...baseColumns, 'cid', 'ctime', 'mid', 'mtime'];
	}

	return groups;
}

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

/**
 * Helper to build query options from processed includes.
 * Used for nested batch loading with Knex whereIn().
 * 
 * @param includes - Include specification for nested entity
 * @param relationship - Relationship configuration
 * @returns Query options with filters and includes for nested entity
 */
export function buildNestedQueryOptions(
	includes: IncludeObject,
	relationship: RelationshipConfig
): { filters: any; includes: IncludeObject } {
	// Create query options for nested entity
	const nestedIncludes = includes as IncludeObject;

	return {
		filters: undefined, // Will be set by parent with whereIn filter
		includes: nestedIncludes
	};
}
