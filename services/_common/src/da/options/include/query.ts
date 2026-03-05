/**
 * Include query building and loading logic
 * 
 * This module provides functions to parse and load nested entity relationships
 * for JOQL $include functionality. It handles belongsTo relationships via JOINs
 * and hasMany/hasOne relationships via batch queries to avoid N+1 problems.
 * 
 * The functions are designed to be called from DAO classes and operate on
 * entity instances and include processor options.
 */

import { IncludeObject } from '#shared/query_options.js';
import { Knex } from 'knex';
import { UserContext } from '../../../user-context.js';
import type { BaseDao } from '../../dao-base.js';
import { getDao } from '../../daos.js';
import { getRelationship, resolveRelationship } from './conf.js';
import {
	ExtendedIncludeProcessorOptions,
	IncludeProcessorOptions
} from './processor.js';

// ============================================================================
// Public Functions
// ============================================================================


/**
 * Build LEFT JOINs for belongsTo relationships recursively.
 * This function iterates through the relationships in the options and adds
 * LEFT JOINs for all belongsTo type relationships, handling nested relationships
 * recursively.
 * 
 * @param query - Knex query builder to add joins to
 * @param options - Include processor options containing relationship configurations
 */
export function buildBelongsToQuery(
	query: Knex.QueryBuilder,
	options: IncludeProcessorOptions
): void {
	// Iterate through all relationships defined in options
	if (!options.relationships) {
		return;
	}

	for (const [relName, relOptions] of Object.entries(options.relationships)) {
		if (!options.entityKey) {
			continue;
		}

		// Get relationship definition from conf.ts
		const relationship = getRelationship(options.entityKey, relName);

		// Only process belongsTo relationships (LEFT JOIN)
		if (relationship.type === 'belongsTo') {
			const targetAlias = relOptions.alias;
			const sourceAlias = options.alias;
			const foreignKey = relationship.foreignKey;
			const targetKey = relationship.targetKey || 'id';

			// Add LEFT JOIN: from (sourceAlias) to (targetAlias)
			// ON sourceAlias.foreignKey = targetAlias.targetKey
			query.leftJoin(
				`${relationship.toTable} as ${targetAlias}`,
				`${sourceAlias}.${foreignKey}`,
				`${targetAlias}.${targetKey}`
			);

			// Recursively process nested relationships
			buildBelongsToQuery(query, relOptions);
		}
	}
}


/**
 * Parses nested properties for belongsTo relationships from flat JOINed data using recursive parsing.
 * Transforms columns with path-based aliases (e.g., 'project_wks_id', 'project_wks_org_name') into nested objects.
 * Uses targetColumns paths to identify which columns belong to which nested entity.
 * 
 * @param record - The database record with aliased columns from JOINs
 * @param options - IncludeProcessorOptions containing targetColumns with path-based structure
 * @returns Parsed record with nested objects
 */
export function parseNestRecord(record: any, options: IncludeProcessorOptions): any {
	if (!record || !options || !options.targetColumns) {
		return record;
	}

	const result = { ...record };

	// Process each path in targetColumns (e.g., '', 'project', 'project.wks', 'project.wks.org')
	for (const [path, columns] of Object.entries(options.targetColumns)) {
		// Skip empty path (main table columns) - they stay at root level
		if (path === '') {
			continue;
		}

		// Extract nested object for this path
		const nestedObj: any = {};
		const pathPrefix = path + '_';
		let hasColumns = false;

		// Find columns that match this path (e.g., 'project_wks_id' for path 'project.wks')
		for (const column of Object.keys(result)) {
			if (column.startsWith(pathPrefix)) {
				const attrName = column.substring(pathPrefix.length);
				nestedObj[attrName] = result[column];
				delete result[column];
				hasColumns = true;
			}
		}

		// If we found columns for this path, assign the nested object
		if (hasColumns) {
			// Build nested path structure (e.g., 'project.wks' -> result.project.wks)
			const pathParts = path.split('.');
			let current = result;
			for (let i = 0; i < pathParts.length; i++) {
				const part = pathParts[i];
				if (i === pathParts.length - 1) {
					// Last part: assign the nested object
					current[part] = nestedObj;
				} else {
					// Intermediate parts: ensure the path exists
					if (!current[part]) {
						current[part] = {};
					}
					current = current[part];
				}
			}
		}
	}

	return result;
}

/**
 * Loads nested entities for hasMany/hasOne relationships and parses belongsTo relationships from JOINed data.
 * Executes batch queries to avoid N+1 problem for hasMany/hasOne.
 * For belongsTo relationships, parses the nested data already present from JOINs.
 * 
 * @param utx - User transaction context
 * @param entities - List of entities to load nested data for
 * @param nestedConfigs - Array of nested include configurations
 * @param joins - Array of JOIN clauses
 * @param dao - DAO instance to use for nested queries
 * @returns Entities with nested data loaded
 */
export async function loadNestedEntities<E>(
	utx: UserContext,
	entities: E[],
	nestedConfigs: ExtendedIncludeProcessorOptions[],
	joins: any[],
	dao: BaseDao<any, any>
): Promise<E[]> {
	if (entities.length === 0 || nestedConfigs.length === 0) {
		return entities;
	}

	const result = [...entities];

	for (const nestedConfig of nestedConfigs) {
		const relationKey = nestedConfig.entityKey || nestedConfig.table || '';
		const config = nestedConfig;

		if (config.relationshipType === 'belongsTo') {
			// For belongsTo relationships, the data is already JOINed and parsed via parseNestRecord
			// We need to recursively process deeper nested relationships if they exist
			const nestedNestedConfigs = buildNestedConfigsForBelongsTo(config);
			if (nestedNestedConfigs.length > 0) {
				// Extract all the nested belongsTo objects from the result entities
				const nestedEntities: any[] = [];
				for (const entity of result) {
					const nestedEntity = (entity as any)[relationKey];
					if (nestedEntity) {
						nestedEntities.push(nestedEntity);
					}
				}

				if (nestedEntities.length > 0) {
					// Get the DAO for the target table
					const targetTable = config.table || relationKey;
					const nestedDao = getDao(targetTable);
					if (!nestedDao) continue;

					// Recursively load deeper nested entities
					const entitiesWithNested = await nestedDao.loadNestedEntities(
						utx,
						nestedEntities,
						nestedNestedConfigs,
						[], // No additional joins needed for belongsTo at this level
						nestedDao
					);

					// Map back to parent entities
					let entityIndex = 0;
					for (const entity of result) {
						if ((entity as any)[relationKey]) {
							(entity as any)[relationKey] = entitiesWithNested[entityIndex++];
						}
					}
				}
			}
			continue;
		}

		// For hasMany and hasOne relationships, use batch queries to avoid N+1 problem
		const parentIds = entities.map(e => (e as any).id);
		
		// Use schema-based DAO lookup
		const targetTable = config.table || relationKey;
		const nestedDao = getDao(targetTable);
		if (!nestedDao) continue;

		const nestAlias = config.alias || 'nest_main';
		const { query } = await dao['knexQuery']({ utx, tableName: `${targetTable} as ${nestAlias}` });
		
		// Build includes object from nestedConfig.relationships
		const includes = buildIncludesFromRelationships(config.relationships);
		
		// Use the nested DAO's processIncludes to properly resolve columns and includes
		const includeResult = nestedDao.processIncludes(includes, nestAlias);
		const { columns, nested: nestedNestedConfigs, joins: nestedJoins } = includeResult;
		
		// Apply column selection if specified (not wildcard)
		if (columns.length > 0 && !(columns.length === 1 && columns[0] === '*')) {
			query.columns(columns);
		}
		
		// Always include the foreign key column for grouping (unless it's already in columns)
		const foreignKey = config.sourceKey || 'id';
		if (!columns.some(col => col === `${nestAlias}.${foreignKey}`) && !columns.includes(foreignKey)) {
			query.column(`${nestAlias}.${foreignKey}`);
		}
		
		// Apply JOINs for belongsTo nested relationships
		for (const join of nestedJoins) {
			query.leftJoin(
				`${join.table} as ${join.as}`,
				join.on.first,
				join.on.operator,
				join.on.second
			);

			// For belongsTo relationships, add column aliases with prefix to avoid name conflicts
			if (join.prefix) {
				for (const col of columns) {
					if (col.startsWith(`${join.as}.`)) {
						const columnName = col.substring(`${join.as}.`.length);
						const aliasName = `${join.prefix}${columnName}`;
						query.column(`${col} as ${aliasName}`);
					}
				}
			}
		}
		
		const nestedEntities = await query
			.whereIn(foreignKey, parentIds)
			.then(records => records.map((r: any) => ({ 
				entity: nestedDao.parseNestedRecord(r, nestedNestedConfigs), 
				parentId: (r as any)[foreignKey] 
			})));
		
		const groupedByParent = new Map<any, any[]>();
		for (const { entity, parentId } of nestedEntities) {
			let obj = {...entity};
			delete obj[foreignKey];
			if (!groupedByParent.has(parentId)) {
				groupedByParent.set(parentId, []);
			}
			groupedByParent.get(parentId)!.push(obj);
		}

		// Recursively load deeper nested entities if any nested configs exist
		const entitiesWithNested = await dao.loadNestedEntities(
			utx, 
			nestedEntities.map((n:any) => n.entity), 
			nestedNestedConfigs, 
			nestedJoins,
			nestedDao
		);

		// Map back to parent entities
		const entityMap = new Map<any, any>();
		for (let i = 0; i < nestedEntities.length; i++) {
			entityMap.set(JSON.stringify(nestedEntities[i].entity), entitiesWithNested[i]);
		}

		for (const entity of result) {
			const parentId = (entity as any).id;
			const nestedList = groupedByParent.get(parentId) || [];
			
			// Replace with entities that have deeper nested data
			const entitiesWithDeeperNested = nestedList.map(nested => {
				const key = JSON.stringify(nested);
				return entityMap.get(key) || nested;
			});

			if (config.relationshipType === 'hasOne') {
				(entity as any)[relationKey] = entitiesWithDeeperNested[0] || null;
			} else {
				(entity as any)[relationKey] = entitiesWithDeeperNested;
			}
		}
	}

	return result;
}

/**
 * Loads nested entities recursively using batch queries to avoid N+1 problem.
 * Handles hasMany, hasOne, and belongsTo relationships at any nesting depth.
 * 
 * @param utx - User transaction context
 * @param entities - List of entities to load nested data for
 * @param options - IncludeProcessorOptions with relationships to load
 * @param dao - DAO instance to use for queries
 * @returns Entities with all nested relationships loaded
 */
export async function loadNestEntity<E>(
	utx: UserContext,
	entities: E[],
	options: IncludeProcessorOptions,
	dao: BaseDao<any, any>
): Promise<E[]> {
	if (entities.length === 0 || !options.relationships || Object.keys(options.relationships).length === 0) {
		return entities;
	}

	const result = [...entities];

	for (const [relationKey, relationOptions] of Object.entries(options.relationships)) {
		// Resolve relationship definition
		let relationshipDef;
		try {
			relationshipDef = resolveRelationship(options.entityKey || options.table || '', relationKey);
		} catch {
			continue;
		}

		if (relationshipDef.type === 'belongsTo') {
			// For belongsTo relationships, data is already JOINed and parsed via parseNestRecord
			// Need to recursively load deeper nested relationships if they exist
			const nestedEntities: any[] = [];
			for (const entity of result) {
				const nestedEntity = (entity as any)[relationKey];
				if (nestedEntity) {
					nestedEntities.push(nestedEntity);
				}
			}

			if (nestedEntities.length > 0 && relationOptions.relationships && Object.keys(relationOptions.relationships).length > 0) {
				// Get the DAO for the target table
				const targetTable = relationOptions.table || relationKey;
				const nestedDao = getDao(targetTable);
				if (!nestedDao) continue;

				// Recursively load deeper nested entities
				const entitiesWithNested = await nestedDao.loadNestEntity(
					utx,
					nestedEntities,
					relationOptions
				);

				// Map back to parent entities
				let entityIndex = 0;
				for (const entity of result) {
					if ((entity as any)[relationKey]) {
						(entity as any)[relationKey] = entitiesWithNested[entityIndex++];
					}
				}
			}
		} else {
			// For hasMany and hasOne, use batch queries
			const parentIds = entities.map(e => (e as any).id);
			const foreignKey = relationshipDef.foreignKey;

			// Get the DAO for the target table
			const targetTable = relationOptions.table || relationKey;
			const nestedDao = getDao(targetTable);
			if (!nestedDao) continue;

			const nestAlias = relationOptions.alias || `${options.alias}_${relationKey}`;
			const { query } = await dao['knexQuery']({ utx, tableName: `${targetTable} as ${nestAlias}` });

			// Build columns from targetColumns in nested options
			const columns: string[] = [];
			for (const cols of Object.values(relationOptions.targetColumns)) {
				columns.push(...cols);
			}

			// Apply column selection
			if (columns.length > 0 && !(columns.length === 1 && columns[0] === '*')) {
				query.columns(columns);
			}

			// Always include the foreign key column for grouping
			if (!columns.some(col => col === `${nestAlias}.${foreignKey}`) && !columns.includes(foreignKey)) {
				query.column(`${nestAlias}.${foreignKey}`);
			}

			// Build JOINs for belongsTo relationships within this hasMany/hasOne level
			const nestedJoins: any[] = [];
			if (relationOptions.relationships) {
				for (const [nestedRelationKey, nestedRelationOptions] of Object.entries(relationOptions.relationships)) {
					try {
						const nestedRelationshipDef = resolveRelationship(relationKey, nestedRelationKey);
						if (nestedRelationshipDef.type === 'belongsTo') {
							nestedJoins.push({
								table: nestedRelationOptions.table,
								as: nestedRelationOptions.alias,
								on: {
									first: `${nestAlias}.${nestedRelationshipDef.foreignKey}`,
									operator: '=',
									second: `${nestedRelationOptions.alias}.${nestedRelationshipDef.targetKey || 'id'}`
								},
								path: `${relationKey}.${nestedRelationKey}`
							});

							// Apply JOIN
							query.leftJoin(
								`${nestedRelationOptions.table} as ${nestedRelationOptions.alias}`,
								`${nestAlias}.${nestedRelationshipDef.foreignKey}`,
								'=',
								`${nestedRelationOptions.alias}.${nestedRelationshipDef.targetKey || 'id'}`
							);

							// Add column aliases for joined tables
							for (const [path, cols] of Object.entries(nestedRelationOptions.targetColumns)) {
								if (path !== '') {
									for (const col of cols) {
										if (col.includes('.')) {
											const columnName = col.split('.')[1];
											query.column(`${col} as ${path}_${columnName}`);
										}
									}
								}
							}
						}
					} catch {
						continue;
					}
				}
			}

			// Execute batch query
			const records = await query.whereIn(`${nestAlias}.${foreignKey}`, parentIds);
			
			// Parse nested records for belongsTo within this hasMany/hasOne level
			const parsedRecords = records.map(r => nestedDao.parseNestedRecord(r, relationOptions));
			
			// Group by parent ID
			const groupedByParent = new Map<any, any[]>();
			for (const record of parsedRecords) {
				const parentId = (record as any)[foreignKey];
				const entity = { ...record };
				delete entity[foreignKey];
				if (!groupedByParent.has(parentId)) {
					groupedByParent.set(parentId, []);
				}
				groupedByParent.get(parentId)!.push(entity);
			}

			// Recursively load deeper nested entities if needed
			if (relationOptions.relationships && Object.keys(relationOptions.relationships).length > 0) {
				const allNestedEntities = parsedRecords;
				const entitiesWithNested = await nestedDao.loadNestEntity(
					utx,
					allNestedEntities,
					relationOptions
				);

				// Create a map for quick lookup
				const entityMap = new Map<any, any>();
				for (let i = 0; i < allNestedEntities.length; i++) {
					entityMap.set(JSON.stringify(allNestedEntities[i]), entitiesWithNested[i]);
				}

				// Map back to parent entities with deeper nested data
				for (const [parentId, nestedList] of groupedByParent.entries()) {
					const entitiesWithDeeperNested = nestedList.map(nested => {
						const key = JSON.stringify(nested);
						return entityMap.get(key) || nested;
					});
					groupedByParent.set(parentId, entitiesWithDeeperNested);
				}
			}

			// Assign nested entities to parent entities
			for (const entity of result) {
				const parentId = (entity as any).id;
				const nestedList = groupedByParent.get(parentId) || [];

				if (relationshipDef.type === 'hasOne') {
					(entity as any)[relationKey] = nestedList[0] || null;
				} else {
					(entity as any)[relationKey] = nestedList;
				}
			}
		}
	}

	return result;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build nested configs for belongsTo relationships from extended processor options.
 * This extracts nested relationship configurations that need to be loaded recursively.
 * 
 * @param config - Extended include processor options
 * @returns Array of extended nested configs for recursive loading
 */
function buildNestedConfigsForBelongsTo(config: ExtendedIncludeProcessorOptions): ExtendedIncludeProcessorOptions[] {
	const nestedConfigs: ExtendedIncludeProcessorOptions[] = [];
	
	// Get the target entity's relationships from the schema
	const targetTable = config.table || config.entityKey || '';
	const targetDao = getDao(targetTable);
	if (!targetDao) {
		return nestedConfigs;
	}

	// Process each nested relationship
	for (const [key, nestedOptions] of Object.entries(config.relationships || {})) {
		const relationshipDef = resolveRelationshipDef(targetTable, key);
		if (relationshipDef) {
			nestedConfigs.push({
				...nestedOptions,
				entityKey: key,
				sourceKey: relationshipDef.foreignKey,
				sourceTableAlias: config.alias,
				relationshipType: relationshipDef.type,
				targetKey: relationshipDef.targetKey || 'id'
			});
		}
	}

	return nestedConfigs;
}

/**
 * Build includes object from relationships map for processIncludes.
 * Converts the relationships Record<string, IncludeProcessorOptions> to IncludeObject format.
 * 
 * @param relationships - Relationships map from IncludeProcessorOptions
 * @returns Include object for processIncludes
 */
function buildIncludesFromRelationships(relationships?: Record<string, IncludeProcessorOptions>): IncludeObject | undefined {
	if (!relationships) {
		return undefined;
	}
	
	const includes: IncludeObject = {};
	for (const [key, opts] of Object.entries(relationships)) {
		// If nested options has no relationships, use true (boolean)
		// Otherwise, build nested includes recursively
		if (!opts.relationships || Object.keys(opts.relationships).length === 0) {
			includes[key] = true;
		} else {
			includes[key] = buildIncludesFromRelationships(opts.relationships) || {};
		}
	}
	
	return includes;
}

/**
 * Resolve relationship definition for a given entity and relation.
 * Looks up the relationship from the schema.
 * 
 * @param entityKey - Source entity key
 * @param relationKey - Relationship name/key
 * @returns Relationship definition or undefined if not found
 */
function resolveRelationshipDef(entityKey: string, relationKey: string): any {
	try {
		const { resolveRelationship } = require('./include-conf.js');
		return resolveRelationship(entityKey, relationKey);
	} catch {
		return undefined;
	}
}
