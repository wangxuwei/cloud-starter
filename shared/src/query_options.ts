export type Op =
	| "$eq"
	| "$in"
	| "$not"
	| "$notIn"
	| "$contains"
	| "$containsAny"
	| "$containsAll"
	| "$notContains"
	| "$notContainsAny"
	| "$startsWith"
	| "$startsWithAny"
	| "$notStartsWith"
	| "$notStartsWithAny"
	| "$endsWith"
	| "$endsWithAny"
	| "$notEndsWith"
	| "$notEndsWithAny"
	| "$lt"
	| "$lte"
	| "$gt"
	| "$gte"
	| "$null"
	| string; // add string to make sure we do not limit to known ones.
export type Val = string | number | boolean | null | any; // for now need to add the 'any' as in the 'maching' case we do not control the E type

/**
 * Filters is one or more Filter object. Each filter object is executed with a OR.
 */
export type QueryFilter<E> = {
	[C in keyof E]?: { [op: Op]: Val | Val[] } | Val;
};

export interface QueryOptions<E> {
	filters?: QueryFilter<E>[] | QueryFilter<E>;
	list_options?: ListOptions;
}

export interface ListOptions {
	limit?: number;
	offset?: number;
	order_bys?: string[];
}
