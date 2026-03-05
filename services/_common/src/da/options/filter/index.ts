import { Op, QueryFilter, Val } from '#shared/query_options';
import { Knex } from 'knex';

export function completeQueryFilter<E>(query: Knex.QueryBuilder, filter: QueryFilter<E>, table:string) {
	for (const key in filter) {
		const column = `${table}.${key}`;
		// value to match
		const value = filter[key];

		// Check if value is an operator object (new format)
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			// New operator format: { "$eq": value } or { "$in": [val1, val2] }
			const opValue = value as { [op: string]: Val | Val[] };
			for (const op in opValue) {
				const opVal = opValue[op];
				applyOperator(query, column, op as Op, opVal);
			}
		}
		// Handle simple value or null (backward compatibility)
		else {
			applyOperator(query, column, '$eq', value as Val);
		}
	}
}


export function applyOperator(query: Knex.QueryBuilder, column: string, op: Op, value: Val | Val[]) {
	switch (op) {
		case '$eq':
			if (value === null) {
				query.whereNull(column);
			} else {
				query.where(column, value);
			}
			break;
		case '$not':
			if (value === null) {
				query.whereNotNull(column);
			} else {
				query.whereNot(column, value);
			}
			break;
		case '$in':
			query.whereIn(column, value as Val[]);
			break;
		case '$notIn':
			query.whereNotIn(column, value as Val[]);
			break;
		case '$contains':
			query.where(column, 'like', `%${value}%`);
			break;
		case '$containsAny':
			if (Array.isArray(value) && value.length > 0) {
				query.andWhere(function () {
					for (let i = 0; i < value.length; i++) {
						this.orWhere(column, 'like', `%${value[i]}%`);
					}
				});
			}
			break;
		case '$containsAll':
			if (Array.isArray(value)) {
				for (const v of value) {
					query.where(column, 'like', `%${v}%`);
				}
			}
			break;
		case '$notContains':
			query.whereNot(column, 'like', `%${value}%`);
			break;
		case '$notContainsAny':
			if (Array.isArray(value) && value.length > 0) {
				query.andWhere(function () {
					for (let i = 0; i < value.length; i++) {
						this.orWhereNot(column, 'like', `%${value[i]}%`);
					}
				});
			}
			break;
		case '$startsWith':
			query.where(column, 'like', `${value}%`);
			break;
		case '$startsWithAny':
			if (Array.isArray(value) && value.length > 0) {
				query.andWhere(function () {
					for (let i = 0; i < value.length; i++) {
						this.orWhere(column, 'like', `${value[i]}%`);
					}
				});
			}
			break;
		case '$notStartsWith':
			query.whereNot(column, 'like', `${value}%`);
			break;
		case '$notStartsWithAny':
			if (Array.isArray(value) && value.length > 0) {
				query.andWhere(function () {
					for (let i = 0; i < value.length; i++) {
						this.orWhereNot(column, 'like', `${value[i]}%`);
					}
				});
			}
			break;
		case '$endsWith':
			query.where(column, 'like', `%${value}`);
			break;
		case '$endsWithAny':
			if (Array.isArray(value) && value.length > 0) {
				query.andWhere(function () {
					for (let i = 0; i < value.length; i++) {
						this.orWhere(column, 'like', `%${value[i]}`);
					}
				});
			}
			break;
		case '$notEndsWith':
			query.whereNot(column, 'like', `%${value}`);
			break;
		case '$notEndsWithAny':
			if (Array.isArray(value) && value.length > 0) {
				query.andWhere(function () {
					for (let i = 0; i < value.length; i++) {
						this.orWhereNot(column, 'like', `%${value[i]}`);
					}
				});
			}
			break;
		case '$lt':
			query.where(column, '<', value);
			break;
		case '$lte':
			query.where(column, '<=', value);
			break;
		case '$gt':
			query.where(column, '>', value);
			break;
		case '$gte':
			query.where(column, '>=', value);
			break;
		case '$null':
			query.whereNull(column);
			break;
		default:
			// For unknown operators, treat as equals (fallback for backward compatibility)
			query.where(column, '=', value);
			break;
	}
}
