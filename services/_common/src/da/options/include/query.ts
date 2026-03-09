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

import { Knex } from "knex";
import { getSysContext, UserContext } from "../../../user-context.js";
import { getRelationship } from "./conf.js";
import { IncludeProcessorOptions } from "./processor.js";

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Build main table columns and relation columns with proper aliases.
 *
 * This function processes the targetColumns from IncludeProcessorOptions
 * and adds them to the query with proper aliases for JOINed tables.
 *
 * For first query (original query): handles both main table columns and relation columns
 * For nested queries: handles only columns for the specific level
 *
 * @param query - Knex query builder to add columns to
 * @param options - IncludeProcessorOptions containing targetColumns map
 */
export function buildMainAndRelationColumns(
  query: Knex.QueryBuilder,
  options: IncludeProcessorOptions
): void {
  // Build columns from targetColumns map (path-based structure)
  for (const [_, col] of Object.entries(options.targetColumns)) {
    query.column(col);
  }

  // Build columns from targetRelationColumns map (path-based structure)
  for (const [path, cols] of Object.entries(options.targetRelationColumns)) {
    for (const col of cols) {
      // should include .
      // For joined table columns, add column alias using format: ${alias}.${col} as ${path_col}
      // The column already has alias.table format, we need to convert to path_col format
      query.column(`${col} as ${path}_${col.split(".")[1]}`);
    }
  }
}

/**
 * Build LEFT JOINs for belongsTo relationships recursively.
 * This function iterates through the relationships in the options and adds
 * LEFT JOINs for all belongsTo type relationships, handling nested relationships
 * recursively.
 *
 * @param query - Knex query builder to add joins to
 * @param options - Include processor options containing relationship configurations
 */
export function buildBelongsJoinToQuery(
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
    if (relationship.type === "belongsTo") {
      const targetAlias = relOptions.alias;
      const sourceAlias = options.alias;
      const foreignKey = relationship.foreignKey;
      const targetKey = relationship.targetKey || "id";

      // Add LEFT JOIN: from (sourceAlias) to (targetAlias)
      // ON sourceAlias.foreignKey = targetAlias.targetKey
      query.leftJoin(
        `${relationship.toTable} as ${targetAlias}`,
        `${sourceAlias}.${foreignKey}`,
        `${targetAlias}.${targetKey}`
      );

      // Recursively process nested relationships
      buildBelongsJoinToQuery(query, relOptions);
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
export function parseNestRecord(
  record: any,
  options: IncludeProcessorOptions
): any {
  if (!record || !options || !options.targetColumns) {
    return record;
  }

  const result = { ...record };

  // Process each path in targetColumns (e.g., '', 'project', 'project.wks', 'project.wks.org')
  for (const [path, columns] of Object.entries(options.targetRelationColumns)) {
    // Skip empty path (main table columns) - they stay at root level
    if (path === "") {
      continue;
    }

    // Extract nested object for this path
    const nestedObj: any = {};
    const pathPrefix = path + "_";
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
      const pathParts = path.split(".");
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
 * Loads nested entities recursively using batch queries to avoid N+1 problem.
 * Handles hasMany, hasOne, and belongsTo relationships at any nesting depth.
 *
 * Logic:
 * - First query already includes all entities connected via continuous belongsTo relationships
 * - For hasMany/hasOne relationships, performs batch queries with CustomQuery to avoid recursion in dao.list
 * - Recursively loads deeper nested relationships until all are processed
 *
 * @param utx - User transaction context
 * @param entities - List of entities to load nested data for
 * @param options - IncludeProcessorOptions with relationships to load
 * @param currentPath - Current path in the relationship hierarchy (used for recursive calls)
 * @returns Entities with all nested relationships loaded
 */
export async function loadNestEntity<E>(
  utx: UserContext,
  entities: E[],
  options: IncludeProcessorOptions,
  currentPath: string = ""
): Promise<E[]> {
  const { getDao } = await import("../../dao-registry.js");
  if (
    entities.length === 0 ||
    !options.relationships ||
    Object.keys(options.relationships).length === 0
  ) {
    return entities;
  }

  const result = [...entities];

  for (const [relationKey, relationOptions] of Object.entries(
    options.relationships
  )) {
    try {
      const relationshipDef = getRelationship(
        options.entityKey || options.table || "",
        relationKey
      );

      if (relationshipDef.type === "belongsTo") {
        // For belongsTo relationships, data is already JOINed and parsed via parseNestRecord
        // Need to recursively load deeper nested relationships if they exist
        const nestedEntities: any[] = [];
        for (const entity of result) {
          const nestedEntity = (entity as any)[relationKey];
          if (nestedEntity) {
            nestedEntities.push(nestedEntity);
          }
        }

        if (
          nestedEntities.length > 0 &&
          relationOptions.relationships &&
          Object.keys(relationOptions.relationships).length > 0
        ) {
          // Recursively load deeper nested entities
          const nestedPath = currentPath
            ? `${currentPath}.${relationKey}`
            : relationKey;
          const entitiesWithNested = await loadNestEntity(
            utx,
            nestedEntities,
            relationOptions,
            nestedPath
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
        const parentIds = entities.map((e) => (e as any).id);
        const foreignKey = relationshipDef.foreignKey;

        // Get the DAO for the target table
        const targetTable = relationOptions.table || relationKey;
        const nestedDao = getDao(targetTable);
        if (!nestedDao) continue;

        // Build CustomQuery to avoid recursion in dao.list
        const customQuery: any = {
          custom: (query: Knex.QueryBuilder) => {
            buildMainAndRelationColumns(query, relationOptions);

            query
              .column(`${relationOptions.alias}.${foreignKey} as ${foreignKey}`)
              .debug(true);
            buildBelongsJoinToQuery(query, relationOptions);
          },
        };

        // Execute batch query with CustomQuery
        const queryOptions: any = {
          custom: customQuery.custom,
          filters: {
            [foreignKey]: { $in: parentIds },
          },
        };

        // Use dao.listByProcessor with CustomQuery to get nested entities
        const sysUtx = await getSysContext();
        let records = [] as any[];
        try {
          records = await nestedDao.listByProcessor(
            sysUtx,
            relationOptions,
            queryOptions
          );
        } catch (e) {
          console.log("Error occurs: ", e);
        }

        // Parse nested records for belongsTo within this hasMany/hasOne level
        const parsedRecords = records.map((r: any) =>
          parseNestRecord(r, relationOptions)
        );

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
        if (
          relationOptions.relationships &&
          Object.keys(relationOptions.relationships).length > 0
        ) {
          const allNestedEntities = parsedRecords;
          const nestedPath = currentPath
            ? `${currentPath}.${relationKey}`
            : relationKey;
          const entitiesWithNested = await loadNestEntity(
            utx,
            allNestedEntities,
            relationOptions,
            nestedPath
          );

          // Create a map for quick lookup
          const entityMap = new Map<any, any>();
          for (let i = 0; i < allNestedEntities.length; i++) {
            entityMap.set(
              JSON.stringify(allNestedEntities[i]),
              entitiesWithNested[i]
            );
          }

          // Map back to parent entities with deeper nested data
          for (const [parentId, nestedList] of groupedByParent.entries()) {
            const entitiesWithDeeperNested = nestedList.map((nested) => {
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

          if (relationshipDef.type === "hasOne") {
            (entity as any)[relationKey] = nestedList[0] || null;
          } else {
            (entity as any)[relationKey] = nestedList;
          }
        }
      }
    } catch {
      continue;
    }
  }

  return result;
}
