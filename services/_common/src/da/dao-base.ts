// <origin src="https://raw.githubusercontent.com/BriteSnow/cloud-starter/master/services/_common/src/da/dao-base.ts" />
// (c) 2019 BriteSnow, inc - This code is licensed under MIT license (see LICENSE for details)

import { Op, QueryFilter, QueryOptions, StampedEntity, Val } from '#shared/entities.js';
import { Knex } from 'knex';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { ensureArray, nowTimestamp, removeProps } from '../utils.js';
import { AccessRequires } from './access.js';
import { knexQuery } from './db.js';

export interface CustomQuery {
	custom?: (q: Knex.QueryBuilder) => void;
}

export interface BaseDaoOptions {
	table: string;
	stamped: boolean;
	idNames?: string | string[];
	/** set the default orderBy. '!' prefix make it DESC. .e.g., 'odr' or '!age' */
	orderBy?: string | null;
	/** Fix the column names for this DAO (get, first, list will filter through those)  */
	columns?: string[];
}

// Note: for now, the knex can take a generic I for where value
// @annoC
export class BaseDao<E, I, Q extends QueryOptions<E> = QueryOptions<E>> {
	readonly table: string;
	readonly idNames: string | string[];
	protected readonly stamped: boolean;
	protected readonly orderBy: string | null;
	protected readonly columns?: string[];

	constructor(opts: BaseDaoOptions) {
		this.table = opts.table;
		this.stamped = opts.stamped;
		this.idNames = (opts.idNames) ? opts.idNames : 'id';
		this.orderBy = (opts.orderBy) ? opts.orderBy : null;
		if (opts.columns) {
			this.columns = opts.columns;
		}
	}

	//#region    ---------- Data Entity Processing ---------- 
	/**
	 * Convenient methods to process a list of object to this entity. 
	 * 
	 * MUST NOT BE OVERRIDEN, override processEntity instead.
	 * 
	 * @param dbRecs 
	 */
	protected parseRecords(dbRecs: any[]): E[] {
		return dbRecs.map(obj => this.parseRecord(obj));
	}

	/**
	 * Parse the raw database record to entity. 
	 * 
	 * Default implementation return return obj as is.
	 * 
	 * Note: usually, this can add some defineProperty to get some data from computation
	 */
	protected parseRecord(dbRec: any): E {
		return dbRec as E;
	}

	/**
	 * Serialize an entity to its database table row record. 
	 * 
	 * By Default, return object as is.
	 */
	protected serializeEntity(entity: E): any {
		return entity;
	}

	/**
	* Clean the data object of any properties that should not be part of the create or update. 
	* This will be and must be caused before before the dao.stamp, for any create/update
	*
	* TODO: Right now, remove in place, but should create new object if needed, and return new object. 
	*/
	protected cleanForSave(utx: UserContext, data: Partial<E>, forCreate = false): Partial<E> {
		// Those will be set in this.stamp
		removeProps(data, ['cid', 'ctime', 'mid', 'mtime']);
		return data;
	}



	protected stamp(utx: UserContext, data: Partial<E>, forCreate?: boolean): Partial<E> {

		if (this.stamped) {
			// Force casting. We can assume this, might have a more elegant way (but should not need StampedDao though)
			return BaseDao.Stamp(utx, data, forCreate);
		} else {
			return data;
		}

	}

	protected static Stamp<T extends StampedEntity>(utx: UserContext, data: T, forCreate?: boolean) {
		const stampedData: Partial<T> & StampedEntity = data;
		const now = nowTimestamp();
		if (forCreate) {
			stampedData.cid = utx.userId;
			stampedData.ctime = now;
		}
		stampedData.mid = utx.userId;
		stampedData.mtime = now;
		return stampedData;
	}
	//#endregion ---------- /Data Entity Processing ---------- 


	//#region    ---------- Public Interface ---------- 

	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async get(utx: UserContext, id: I): Promise<E> {
		const { query } = await knexQuery({ utx, tableName: this.table });

		if (this.columns) {
			query.columns(this.columns);
		}
		const r = await query.where(this.getWhereIdObject(id));

		if (r.length === 0) {
			throw new Error(`dao.get error, can't find ${this.table}[${id}]`);
		}
		return this.parseRecord(r[0]);
	}

	/**
	 * Same as getForIds, but allow some array item to be undefined, and when so, undefined will be returned.
	 * @param ids 
	 */
	@AccessRequires() // will force #sys only for baseDao
	async getForSomeIds(utx: UserContext, ids: (I | undefined)[]): Promise<(E | undefined)[]> {
		// first filter the none defined
		const definedIds = ids.filter(v => v !== undefined) as I[]; // help typing system
		// NOTE: here we forst the id property, as per limitationof this API
		const entities = await this.getForIds(utx, definedIds);
		// NOTE: Also, here we need to explicity set the correct type (typescript get it wrong :(, they are working on it)
		// NOTE: Also, here we assume that the entity as .id. Will  need to clean this up.
		const a = entities.map((ent: E) => [(<any>ent).id, ent]) as [number, E][];
		const entityById = new Map(a);

		// Note: assume number for ids so cast it
		return (<unknown>ids as number[]).map(id => (id !== undefined) ? entityById.get(id) : undefined);
	}

	/**
	 * Return a list of entity for a list of id. 
	 * - Assume the .id the id property of this entity (need to be generalized)
	 * - Assume .id is a number
	 * @param utx 
	 * @param ids 
	 */
	@AccessRequires() // will force #sys only for baseDao
	async getForIds(utx: UserContext, ids: I[]): Promise<E[]> {
		const { query } = await knexQuery({ utx, tableName: this.table });

		// for now only supports dao that have 'id' as key (i.e. assumption are numbers)
		if (this.idNames === 'id') {
			query.whereIn('id', (<any>ids) as number[]);
		} else {
			throw new Error(`Can't call getForIds on a dao that does not have 'id' and idNames ${this.constructor.name}`);
		}


		const r = (await query.then()) as any[];
		return this.parseRecords(r);
	}

	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async first(utx: UserContext, data: Partial<E>): Promise<E | null> {
		const { query } = await knexQuery({ utx, tableName: this.table });


		const options = { filters: data, list_options: {limit: 1} } as (QueryOptions<E> & Q); // needs typing int
		this.completeQueryBuilder(utx, query, options);
		const entities = (await query.then()) as any[];

		if (entities.length === 0) {
			return null;
		}
		return this.parseRecord(entities[0]);
	}

	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async create(utx: UserContext, data: Partial<E>): Promise<I> {
		const { query } = await knexQuery({ utx, tableName: this.table });

		data = this.cleanForSave(utx, data, true);
		data = this.stamp(utx, data, true);

		// NOTE: By default, thereturning this.idNames is .id
		const r = await query.insert(data).returning(this.idNames as 'id');
		return r[0].id as I;
	}

	/**
	 * Try a create and if fail ON CONFLICT, return the id matching the uniqueProps name/values
	 * Note: this is not really an upsert because does not update anything if can't insert. 
	 * TODO: Use the on ... ON CONFLICT ... way
	 * @param utx 
	 * @param data 
	 * @param uniqueProps 
	 */
	@AccessRequires() // will force #sys only for baseDao
	async createOrGetId(utx: UserContext, data: Partial<E>, uniqueProps: Partial<E>): Promise<I> {
		let id: I;
		try {
			id = await this.create(utx, data);
		} catch (ex: any) {
			// for now,  we will assume it is on on conflict with the uniqueProp
			const { query } = await knexQuery({ utx, tableName: this.table });

			const idNames = (this.idNames instanceof Array) ? this.idNames : [this.idNames];
			const r = await query.select().column(idNames).where(uniqueProps);

			if (r.length === 0) {
				const desc = `Can't get ${this.table} on unique props ${uniqueProps} after conflict create (conflict cause: ${ex.message})`;
				// TODO: need to enable when log framework get implemented
				// utx.log({ level: 'error', method: 'BaseDao.silentCreate', desc });
				throw desc;
			}

			const val = r[0];
			id = (idNames.length === 1) ? val[idNames[0]] : val;
		}

		return id;
	}

	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async update(utx: UserContext, id: I, data: Partial<E>) {
		const { query } = await knexQuery({ utx, tableName: this.table });

		this.cleanForSave(utx, data);
		this.stamp(utx, data);

		const r = await query.update(data).where(this.getWhereIdObject(id));
		return r;
	}

	@AccessRequires() // will force #sys only for baseDao
	async updateBulk(utx: UserContext, fn: (k: Knex.QueryBuilder) => void, data: Partial<E>) {
		const { query } = await knexQuery({ utx, tableName: this.table });

		query.update(data);
		fn(query);

		this.cleanForSave(utx, data);
		this.stamp(utx, data);

		const r = await query;
		return r;
	}



	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async list(utx: UserContext, queryOptions?: Q & CustomQuery): Promise<E[]> {
		const { query } = await knexQuery({ utx, tableName: this.table });

		this.completeQueryBuilder(utx, query, queryOptions);
		const records = (await query.debug(true).then()) as any[]; // TODO: need to check if this is the common way
		return this.parseRecords(records);
	}

	/**
	 * Remove one or more entities from one or more id
	 */
	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async remove(utx: UserContext, ids: I | I[]) {
		const { query } = await knexQuery({ utx, tableName: this.table });

		// if we have a bulk ids, try to do the whereIn (for non-compound for now)
		if (ids instanceof Array) {
			//// if single id properties, we can do whereIn
			if (typeof this.idNames === 'string') {
				return query.delete().whereIn(this.idNames, ids as any);
			}
			//// if not a compound id, need to do it one by one for now. 
			else {
				let deleteCount = 0;
				for (const id of ids) {
					deleteCount += await query.delete().where(this.getWhereIdObject(id));
				}
				return deleteCount;
			}

		}
		// otherwise, if single id, so ssingle delete
		else {
			return query.delete().where(this.getWhereIdObject(ids));
		}
	}
	//#endregion ---------- /Public Interface ---------- 


	//#region    ---------- Query Processors ---------- 
	protected completeQueryBuilder(utx: UserContext, query: Knex.QueryBuilder, queryOptions?: Q & CustomQuery) {
		// if this dao has a fixed column. 
		if (this.columns) {
			query.columns(this.columns);
		}

		if (queryOptions) {

			if (queryOptions.custom) {
				queryOptions.custom(query);
			}

			if (queryOptions.list_options?.limit != null) {
				query.limit(queryOptions.list_options?.limit);
			}

			if (queryOptions.list_options?.offset != null) {
				query.offset(queryOptions.list_options?.offset);
			}

			//// add the filters
			if (queryOptions.filters) {
				const filters = queryOptions.filters;
				if (filters instanceof Array) {
					for (const filter of filters) {
						query.andWhere(function () {
							completeQueryFilter(this, filter);
						});
					}
				} else {
					completeQueryFilter(query, filters);
				}
			}

			//// add the orderBy
			let orderBy = (queryOptions.list_options?.order_bys !== undefined) ? queryOptions.list_options?.order_bys : this.orderBy;
			if (orderBy) {
				const orderBys = ensureArray(orderBy);
				for(const orderByColExpr of orderBys ){
					let asc = true;
					let orderByCol = orderByColExpr;
					if (orderByColExpr.startsWith('!')) {
						asc = false;
						orderByCol = orderByColExpr.substring(1);
					}
					query.orderBy(orderByCol, (asc) ? 'ASC' : 'DESC');
				}
			}

		}

	}

	private getWhereIdObject(id: any) {
		// otherwise, build the object with all of the appropriate id
		const r: any = {};

		const t = typeof id;

		// if the id value is a scalar number/string, then, check and return the appropriate object
		if (t === 'number' || t === 'string') {
			if (this.idNames instanceof Array) {
				throw new Error(`Dao for ${this.table} has composite ids ${this.idNames} but method passed only one parameter ${id}`);
			}
			const name = this.idNames as string;
			r[name] = id;
		}

		else {
			for (const name of this.idNames) {
				const val = id[name];
				if (val == null) {
					throw new Error(`Dao for ${this.table} requires id property ${name}, but not present it ${id}`);
				}
				r[name] = val;
			}
		}

		return r;

	}
	//#endregion ---------- /Query Processors ---------- 

}

function completeQueryFilter<E>(query: Knex.QueryBuilder, filter: QueryFilter<E>) {
	for (const column in filter) {

		// value to match
		const value = filter[column];

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


function applyOperator(query: Knex.QueryBuilder, column: string, op: Op, value: Val | Val[]) {
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
