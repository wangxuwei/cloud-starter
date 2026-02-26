/**
 * Query Options types for JOQL (Json Oriented Query Language)
 * This module provides type definitions for filtering, including, and pagination
 * when querying entities through JSON-RPC methods.
 */

// ============================================================================
// Types
// ============================================================================

// Value types that can be used in query filters
export type Val = string | number | boolean | Date | Val[];

// Filter operators
export type Op =
	// Equality operators
	| '$eq' // Exact match (same as no operator)
	| '$in' // Match any value in array
	| '$not' // Does not equal exact value
	| '$notIn' // Does not equal any value in array

	// String operators
	| '$contains' // String contains substring
	| '$notContains' // String does not contain substring
	| '$containsAny' // String contains any substring in array
	| '$notContainsAny' // String does not contain any substring in array
	| '$containsAll' // String contains all substrings in array
	| '$startsWith' // String starts with
	| '$notStartsWith' // String does not start with
	| '$startsWithAny' // String starts with any value in array
	| '$notStartsWithAny' // String does not start with any value in array
	| '$endsWith' // String ends with
	| '$notEndsWith' // String does not end with
	| '$endsWithAny' // String ends with any value in array
	| '$notEndsWithAny' // String does not end with any value in array

	// Comparison operators
	| '$lt' // Less than
	| '$lte' // Less than or equal
	| '$gt' // Greater than
	| '$gte' // Greater than or equal

	// Null check
	| '$null'; // Check if value is null

/**
 * A single query filter condition.
 * Can be a simple value (implicit $eq), an operator object, or an array of filters (OR logic).
 */
export type QueryFilter<E> = {
	[K in keyof E]?: Val | { [O in Op]?: Val } | Val[];
};

/**
 * Include specification - can be boolean, nested object, or undefined.
 */
export type IncludeSpec = boolean | IncludeObject;

/**
 * Include object with string keys mapping to include specifications.
 * Used for nested includes and property selection.
 */
export interface IncludeObject {
	[key: string]: IncludeSpec;
}

/**
 * Relationship type for entity relationships.
 * - 'belongsTo': Many-to-one relationship (foreign key on this entity)
 * - 'hasMany': One-to-many relationship (foreign key on related entity)
 * - 'hasOne': One-to-one relationship (foreign key on related entity)
 */
export type RelationshipType = 'belongsTo' | 'hasMany' | 'hasOne';

/**
 * Configuration for a relationship between two entities.
 * Defines how to join and query related entities.
 */
export interface RelationshipConfig {
	type: RelationshipType; // Relationship type
	targetTable: string; // Target table name
	foreignKey: string; // Foreign key column in source table
	targetKey?: string; // Target table's primary key (defaults to 'id')
	as?: string; // Table alias for this relationship
	targetColumns?: string[]; // Default columns for target entity
	targetColumnGroups?: Record<string, string[]>; // Column groups for target
	targetStamped?: boolean; // Whether target entity has audit columns
}

/**
 * Order by specification with optional direction.
 * Prefix with '!' for descending order.
 */
export type OrderBySpec = string;

/**
 * List options for pagination and sorting.
 */
export interface ListOptions {
	limit?: number;
	offset?: number;
	order_bys?: OrderBySpec[];
}

/**
 * Query options for entity queries.
 * Provides filtering, including, and pagination capabilities.
 */
export interface QueryOptions<E> {
	filters?: QueryFilter<E>[] | QueryFilter<E>;
	includes?: IncludeObject;
	list_options?: ListOptions;
}

// ============================================================================
// Re-export from entities-base for backward compatibility
// ============================================================================

// These are re-exported from entities-base.ts to maintain existing import paths
