/**
 * Include processing utilities for JOQL $include functionality
 *
 * This module provides functions to recursively process include specifications
 * into query configurations, supporting unlimited nesting depth.
 *
 * Now refactored to use the centralized include-schema for all configuration.
 */

import type { IncludeObject } from "#shared/query_options.js";
import {
  getEntityIncludeColumns,
  getEntityIncludeRelations,
  getRelationship,
  IncludeRelationSpec,
} from "./conf.js";

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
  targetColumns: string[];
  /** Final columns for database query (resolved from includes) - path-based structure */
  targetRelationColumns: Record<string, string[]>;
  /** Original include spec for this level (from user query) */
  spec?: IncludeObject | boolean | undefined;
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
  if (column.includes(".") || column === "*") {
    return column;
  }
  return `${alias}.${column}`;
}

// ============================================================================
// Public Functions
// ============================================================================

/**
 * Validate include processor options.
 * Checks that all keys in includeObject are valid columns, column groups, or relationships.
 * Also validates pivot columns for manyToMany relationships.
 *
 * @param includeObject - The include specification to validate
 * @param entityKey - Entity key to lookup valid columns and relationships from schema
 * @param relations - Relationships to validate against (for nested levels, passed from first level)
 * @param path - Current path for error messages (dot-notation, e.g., 'project.wks')
 * @throws Error if any include key is invalid
 */
export function validateIncludeProcessor(
  includeObject: IncludeObject | undefined | boolean,
  entityKey: string,
  lastEntityKey?: string,
  relations?: IncludeRelationSpec,
  path: string = ""
): void {
  // Get valid columns from current entity
  const entityIncludeColumns = getEntityIncludeColumns(entityKey);

  // Get valid relationships from current entity (first level) or use passed relations
  let validRelationships = {};
  if (relations) {
    if (
      typeof relations == "object" &&
      relations[entityKey] &&
      typeof relations[entityKey] == "object"
    ) {
      validRelationships = relations[entityKey];
    }
  } else if (path == "") {
    validRelationships = getEntityIncludeRelations(entityKey);
  }

  const validColumns = new Set(entityIncludeColumns.allColumns);
  const validColumnGroups = new Set(
    Object.keys(entityIncludeColumns.columnGroups)
  );
  const validRelationshipKeys = new Set(Object.keys(validRelationships));

  // If no includes or boolean true, no validation needed
  if (
    !includeObject ||
    typeof includeObject !== "object" ||
    Object.keys(includeObject).length === 0
  ) {
    return;
  }

  // Validate each include key
  for (const [key, spec] of Object.entries(includeObject)) {
    if (spec === false) continue;

    const currentPath = path ? `${path}.${key}` : key;

    if (key.startsWith("_")) {
      // Validate column group
      if (!validColumnGroups.has(key)) {
        throw new Error(
          `Invalid include at path '${currentPath}': '${key}' is not a valid column group for entity '${entityKey}'. ` +
            `Valid column groups: ${Array.from(validColumnGroups).join(", ")}`
        );
      }
    } else {
      // Must be either a valid relationship (from current entity) or a valid column
      const isValidRelationship = validRelationshipKeys.has(key);
      const validContainPivotColumns = new Set(validColumns);

      // For manyToMany relationships, validate pivot columns
      if (lastEntityKey) {
        const relationshipDef = getRelationship(lastEntityKey, entityKey);
        if (
          relationshipDef &&
          relationshipDef.type === "manyToMany" &&
          relationshipDef.pivotColumns
        ) {
          const validPivotColumns = new Set(relationshipDef.pivotColumns);
          for (const c of validPivotColumns) {
            validContainPivotColumns.add(c);
          }
        }
      }
      const isValidColumn = validContainPivotColumns.has(key);
      if (!isValidRelationship && !isValidColumn) {
        let message = `Invalid include at path '${currentPath}': '${key}' is not a valid key for entity '${entityKey}'. `;
        if (validRelationshipKeys && validRelationshipKeys.size > 0) {
          message += `Valid relationships: ${Array.from(
            validRelationshipKeys
          ).join(", ")}. `;
        }

        throw new Error(
          message +
            `Valid columns: ${Array.from(validContainPivotColumns).join(", ")}`
        );
      }

      if (
        isValidRelationship &&
        typeof spec === "object" &&
        !Array.isArray(spec)
      ) {
        // Recursively validate nested relationships
        validateIncludeProcessor(
          spec,
          key,
          entityKey,
          validRelationships,
          currentPath
        );
      }
    }
  }
}

/**
 * Build include processor options from include specification.
 * Converts IncludeObject to IncludeProcessorOptions by resolving
 * details from the schema and handling nested relationships.
 *
 * @param includeObject - The include specification from query options
 * @param entityKey - Entity key to lookup schema data
 * @param rootEntityKey - Root entity key for relationship resolution perspective
 * @param alias - Table alias for this level
 * @param path - Current path for nested belongsTo columns (dot-notation, e.g., 'project.wks')
 * @returns Processed include options
 */
function buildIncludeProcessorOptions(
  includeObject: IncludeObject | undefined | boolean,
  entityKey: string,
  alias: string,
  relations?: Record<string, IncludeRelationSpec>,
  path: string = ""
): IncludeProcessorOptions {
  const entityIncludeColumns = getEntityIncludeColumns(entityKey);

  // Get valid relationships from current entity (first level) or use passed relations
  const validRelationships = relations || getEntityIncludeRelations(entityKey);

  const options: IncludeProcessorOptions = {
    alias,
    entityKey,
    table: entityKey,
    columns: entityIncludeColumns.defaultColumns,
    columnGroups: entityIncludeColumns.columnGroups,
    targetColumns: [],
    targetRelationColumns: {},
    relationships: validRelationships as any,
    spec: includeObject, // Store original spec for this level
  };

  // If no includes specified, return defaults with main table columns
  if (
    !includeObject ||
    typeof includeObject !== "object" ||
    Object.keys(includeObject).length === 0
  ) {
    options.targetColumns = options
      .columns!.filter((col) => {
        return entityIncludeColumns.allColumns.includes(col);
      })
      .map((c) => addTableAlias(c, alias));
    return options;
  }

  // Build direct columns and column groups
  const directColumns = new Set<string>();

  // Process each include key
  for (const [key, spec] of Object.entries(includeObject)) {
    if (spec === false) continue;

    if (key.startsWith("_")) {
      // Column group
      if (options.columnGroups && options.columnGroups[key]) {
        for (const col of options.columnGroups[key]) {
          directColumns.add(addTableAlias(col, alias));
        }
      }
    } else if (
      typeof spec === "boolean" ||
      (typeof spec === "object" && !Array.isArray(spec))
    ) {
      // Check if this is a valid relationship defined in current entity's relationship specs
      let nestedRelationship = validRelationships[key]
        ? validRelationships[key]
        : false;
      const isValidRelationship = nestedRelationship ? true : false;

      if (isValidRelationship) {
        // It's a valid relationship (either boolean true or nested object)
        const relKey = key;
        const relAlias = `${alias}_${key}`;
        const relPath = path ? `${path}.${key}` : key;
        const relSpec = spec === true ? undefined : (spec as IncludeObject);

        let validNestRelationShip = {} as Record<string, IncludeRelationSpec>;
        if (nestedRelationship === true) {
          validNestRelationShip = {} as any;
        } else {
          validNestRelationShip = nestedRelationship as any;
        }

        // Build nested options for this relationship
        const nestedOptions = buildIncludeProcessorOptions(
          relSpec,
          relKey,
          relAlias,
          validNestRelationShip,
          relPath
        );
        options.relationships![key] = nestedOptions;

        // belong to relationship
        let relationType = getRelationship(entityKey, relKey)?.type;
        if (relationType == "belongsTo") {
          options.targetRelationColumns[relPath] = nestedOptions.targetColumns;
          if (Object.keys(nestedOptions.targetRelationColumns).length > 0) {
            for (const nestPath in nestedOptions.targetRelationColumns) {
              let prefix = (path ? path + "." : "") + nestPath;
              options.targetRelationColumns[`${prefix}`] =
                nestedOptions.targetRelationColumns[prefix];
            }
          }
        }
      } else {
        // It's not a relationship, treat as direct column (spec must be true to include)
        if (spec === true && entityIncludeColumns.allColumns.includes(key)) {
          directColumns.add(addTableAlias(key, alias));
        }
      }
    }
  }

  // Set final target columns in path-based structure
  if (directColumns.size > 0) {
    options.targetColumns = Array.from(directColumns);
  } else {
    options.targetColumns = options
      .columns!.filter((col) => {
        return entityIncludeColumns.allColumns.includes(col);
      })
      .map((c) => addTableAlias(c, alias));
  }

  return options;
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
  alias: string = "main"
): IncludeProcessorOptions {
  // Validate the include specification first
  validateIncludeProcessor(includeObject, entityKey);

  const options = buildIncludeProcessorOptions(includeObject, entityKey, alias);
  return options;
}
