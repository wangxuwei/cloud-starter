// <origin src="https://raw.githubusercontent.com/BriteSnow/cloud-starter/master/services/_common/src/dao-base.ts" />
// (c) 2019 BriteSnow, inc - This code is licensed under MIT license (see LICENSE for details)

import { Op, QueryFilter, QueryOptions, StampedEntity, Val } from '#shared/entities.js';
import { RelationshipConfig } from '#shared/query_options.js';
import { Knex } from 'knex';
import { Monitor } from '../perf.js';
import { UserContext } from '../user-context.js';
import { ensureArray, nowTimestamp, removeProps } from '../utils.js';
import { AccessRequires } from './access.js';
import { knexQuery } from './db.js';
import {
	buildDefaultGroups,
	IncludeProcessorOptions,
	IncludeProcessResult,
	JoinClause,
	NestedIncludeConfig,
	processIncludes
} from './include-utils.js';

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
	/** All columns available for validation in includes */
	allColumns?: string[];
	/** Relationships configuration for nested includes */
	relationships?: Record<string, RelationshipConfig>;
}

// Note: for now, the knex can take a generic I for where value
// @annoC
export class BaseDao<E, I, Q extends QueryOptions<E> = QueryOptions<E>> {
	readonly table: string;
	readonly idNames: string | string[];
	protected readonly stamped: boolean;
	protected readonly orderBy: string | null;
	protected readonly columns?: string[];
	protected relationships?: Record<string, RelationshipConfig>;
	protected columnGroups?: Record<string, string[]>;
	protected readonly allColumns?: string[];

	constructor(opts: BaseDaoOptions) {
		this.table = opts.table;
		this.stamped = opts.stamped;
		this.idNames = (opts.idNames) ? opts.idNames : 'id';
		this.orderBy = (opts.orderBy) ? opts.orderBy : null;
		this.relationships = opts.relationships;
		if (opts.columns) {
			this.columns = opts.columns;
		}
		if (opts.allColumns) {
			this.allColumns = opts.allColumns;
		}
		if (this.stamped) {
			this.columnGroups = buildDefaultGroups(this.columns || ['id'], true);
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
	 * Parse raw database record to entity. 
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

	//#region    ---------- Include Processing ---------- 
	/**
	 * Builds include processor options for this DAO.
	 * Can be overridden in subclasses to add custom groups and relationships.
	 */
	protected getIncludeProcessorOptions(): IncludeProcessorOptions {
		return {
			columns: this.columns,
			allColumns: this.allColumns,
			columnGroups: this.columnGroups,
			stamped: this.stamped,
			relationships: this.relationships,
			tableAlias: 'main'
		};
	}

	/**
	 * Processes includes into Knex query configuration.
	 */
	protected processIncludes(includes?: any): IncludeProcessResult {
		const options = this.getIncludeProcessorOptions();
		return processIncludes(includes, options, '', 'main');
	}

	/**
	 * Parses nested properties for belongsTo relationships from flat JOINed data.
	 * Transforms columns like 'workspace_id', 'workspace_name' into nested object { workspace: { id, name } }.
	 */
	protected parseNestedRecord(record: any, nestedConfigs: NestedIncludeConfig[]): any {
		if (!record || nestedConfigs.length === 0) {
			return record;
		}

		const result = { ...record };

		// Create a map for quick lookup by relation name
		const configMap = new Map<string, NestedIncludeConfig>();
		for (const config of nestedConfigs) {
			configMap.set(config.relation, config);
		}

		// Find columns that belong to nested belongsTo relations (pattern: relation_columnName or relation.columnName)
		const nestedRelations = new Set<string>();
		for (const column of Object.keys(result)) {
			// Check for prefix format: relation_columnName (e.g., workspace_id)
			const underscoreIndex = column.indexOf('_');
			if (underscoreIndex > 0) {
				const relation = column.substring(0, underscoreIndex);
				if (configMap.has(relation) && configMap.get(relation)!.config.type === 'belongsTo') {
					nestedRelations.add(relation);
					continue;
				}
			}

			// Check for dot format: relation.columnName (e.g., workspace.id) - fallback for compatibility
			const dotIndex = column.indexOf('.');
			if (dotIndex > 0) {
				const relation = column.substring(0, dotIndex);
				if (configMap.has(relation) && configMap.get(relation)!.config.type === 'belongsTo') {
					nestedRelations.add(relation);
				}
			}
		}

		// For each nested belongsTo relation, extract columns and create nested object
		for (const relation of nestedRelations) {
			const nestedObj: any = {};
			const relationPrefix = relation + '_';
			const relationDot = relation + '.';

			// Use prefix from join config if available, otherwise fallback to relation name
			const joinPrefix = relationPrefix;

			// Extract columns starting with the relation prefix (e.g., workspace_id, workspace_name)
			for (const column of Object.keys(result)) {
				if (column.startsWith(joinPrefix)) {
					const attrName = column.substring(joinPrefix.length);
					nestedObj[attrName] = result[column];
					delete result[column];
				}
				// Fallback: also handle dot notation for backward compatibility
				else if (column.startsWith(relationDot)) {
					const attrName = column.substring(relationDot.length);
					// Only add if not already added (prefer prefix version)
					if (nestedObj[attrName] === undefined) {
						nestedObj[attrName] = result[column];
					}
					delete result[column];
				}
			}

			// Assign nested object to the relation key
			result[relation] = nestedObj;
		}

		return result;
	}

	/**
	 * Loads nested entities for hasMany/hasOne relationships and parses belongsTo relationships from JOINed data.
	 * Executes batch queries using Knex query builder to avoid N+1 problem for hasMany/hasOne.
	 * For belongsTo relationships, parses the nested data already present from JOINs.
	 */
	protected async loadNestedEntities(
		utx: UserContext,
		entities: E[],
		nestedConfigs: NestedIncludeConfig[],
		joins: any[]
	): Promise<E[]> {
		if (entities.length === 0 || nestedConfigs.length === 0) {
			return entities;
		}

		const result = [...entities];

		for (const nestedConfig of nestedConfigs) {
			const { relation, config, includes, sourceKey } = nestedConfig;

			// For belongsTo relationships, the data is already JOINed and parsed via parseNestedProps
			// No need for additional batch queries
			if (config.type === 'belongsTo') {
				continue;
			}

			// For hasMany and hasOne relationships, use batch queries to avoid N+1 problem
			const parentIds = entities.map(e => (e as any).id);
			const nestedDao = this.getRelatedDao(relation);
			if (!nestedDao) continue;

			// For hasMany and hasOne, simple whereIn query
			const { query } = await knexQuery({ utx, tableName: config.targetTable });
			const nestedEntities = await query
				.whereIn(config.foreignKey, parentIds)
				.then(records => records.map((r: any) => ({ entity: nestedDao.parseRecord(r), parentId: (r as any)[config.foreignKey] })));

			const groupedByParent = new Map<I, any[]>();
			for (const { entity, parentId } of nestedEntities) {
				if (!groupedByParent.has(parentId)) {
					groupedByParent.set(parentId, []);
				}
				groupedByParent.get(parentId)!.push(entity);
			}

			for (const entity of result) {
				const parentId = (entity as any).id;
				const nestedList = groupedByParent.get(parentId) || [];

				if (config.type === 'hasOne') {
					(entity as any)[relation] = nestedList[0] || null;
				} else {
					(entity as any)[relation] = nestedList;
				}
			}
		}

		return result;
	}

	/**
	 * Get DAO instance for a relationship. Override in subclasses.
	 */
	protected getRelatedDao(relation: string): BaseDao<any, any> | null {
		return null;
	}
	//#endregion ---------- /Include Processing ---------- 

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
		// NOTE: here we first of of id property, as per limitation of this API
		const entities = await this.getForIds(utx, definedIds);
		// NOTE: Also, here we need to explicitly set the correct type (typescript get it wrong :(, they are working on it)
		// NOTE: Also, here we assume that the entity as .id. Will  need to clean this up.
		const a = entities.map((ent: E) => [(<any>ent).id, ent]) as [number, E][];
		const entityById = new Map(a);

		// Note: assume number for ids so cast it
		return (<unknown>ids as number[]).map(id => (id !== undefined) ? entityById.get(id) : undefined);
	}

	/**
	 * Return a list of entity for a list of id. 
	 * - Assume to .id id property of this entity (need to be generalized)
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
		const result = await this.completeQueryBuilder(utx, query, options);
		const nested = result.nested;
		const entities = (await query.then()) as any[];

		if (entities.length === 0) {
			return null;
		}

		const entity = this.parseNestedRecord(entities[0], result.nested);
		// Load nested entities for hasMany/hasOne relationships
		if (nested.length > 0) {
			const parsedEntity = this.parseRecord(entity);
			const entitiesWithNest = await this.loadNestedEntities(utx, [parsedEntity], nested, result.joins);
			return entitiesWithNest[0];
		}

		return this.parseRecord(entity);
	}

	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async create(utx: UserContext, data: Partial<E>): Promise<I> {
		const { query } = await knexQuery({ utx, tableName: this.table });

		data = this.cleanForSave(utx, data, true);
		data = this.stamp(utx, data, true);

		// NOTE: By default, the returning this.idNames is .id
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
		const alias = this.getIncludeProcessorOptions().tableAlias;
		const { query } = await knexQuery({ utx, tableName: `${this.table} as ${alias}` });

		const result = await this.completeQueryBuilder(utx, query, queryOptions);
		const records = (await query.debug(true).then()) as any[];
		
		// Parse nested records from JOINed tables
		const parsedRecords = records.map(r => this.parseNestedRecord(r, result.nested));
		const entities = this.parseRecords(parsedRecords);

		// Load nested entities for hasMany/hasOne relationships
		if (result.nested.length > 0) {
			return this.loadNestedEntities(utx, entities, result.nested, result.joins);
		}

		return entities;
	}

	/**
	 * Remove one or more entities from one or more id
	 */
	@Monitor()
	@AccessRequires() // will force #sys only for baseDao
	async remove(utx: UserContext, ids: I | I[]) {
		const { query } = await knexQuery({ utx, tableName: this.table });

		// if we have a bulk ids, try to do to whereIn (for non-compound for now)
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
		// otherwise, if single id, so single delete
		else {
			return query.delete().where(this.getWhereIdObject(ids));
		}
	}
	//#endregion ---------- /Public Interface ---------- 


	//#region    ---------- Query Processors ---------- 
	protected completeQueryBuilder(utx: UserContext, query: Knex.QueryBuilder, queryOptions?: Q & CustomQuery): {nested: NestedIncludeConfig[], joins: JoinClause[]} {
		const alias = this.getIncludeProcessorOptions().tableAlias;
		// if this dao has a fixed column. 
		if (this.columns) {
			query.columns(this.columns);
		}
		const nested: NestedIncludeConfig[] = [];
		const joins: any[] = [];

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

			// Process includes if provided
			const includes = queryOptions?.includes;
			
			if (includes) {
				const includeResult = this.processIncludes(includes);
				const { columns, joins: joinClauses, nested: nestedConfigs } = includeResult;
				joins.push(...joinClauses);
				nested.push(...nestedConfigs);

				// Apply column selection if specified (otherwise use default columns logic in completeQueryBuilder)
				if (columns.length > 0 && !(columns.length === 1 && columns[0] === '*')) {
					query.column(columns.filter(col => col.indexOf(".") <= 0 || col.startsWith(`${alias}.`) ));
				}

				// When we have joins but no main table columns selected, automatically add default columns.
				// This ensures proper nesting: joined table columns will have table aliases (e.g., "workspace.id")
				// while main table columns won't (e.g., just "id"), allowing the parser to distinguish them.
				// Without this, SELECT * would mix columns from both tables, causing nested data to appear at top level.
				const hasMainColumns = columns.some(col => !col.includes('.') && col !== '*');
				if (joins.length > 0 && !hasMainColumns && this.columns) {
					// Add default main table columns to ensure proper structure
					for (const col of this.columns) {
						query.column(`${alias}.${col}`);
					}
				}

				// Apply JOINs for belongsTo relationships
				for (const join of joinClauses) {
					query.leftJoin(
						`${join.table} as ${join.as}`,
						join.on.first,
						join.on.operator,
						join.on.second
					);

					// For belongsTo relationships, add column aliases with prefix to avoid name conflicts
					// e.g., workspace.id -> workspace_id, workspace.name -> workspace_name
					if (join.prefix) {
						for (const col of columns) {
							// Only add alias for columns that belong to this joined table
							if (col.startsWith(`${join.as}.`)) {
								const columnName = col.substring(`${join.as}.`.length);
								const aliasName = `${join.prefix}${columnName}`;
								query.column(`${col} as ${aliasName}`);
							}
						}
					}
				}
			}

			//// add() filters
			if (queryOptions.filters) {
				const filters = queryOptions.filters;
				if (filters instanceof Array) {
					for (const filter of filters) {
						query.andWhere(function () {
							completeQueryFilter(this, filter, alias!);
						});
					}
				} else {
					completeQueryFilter(query, filters, alias!);
				}
			}

			//// add() orderBy
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

		return {nested, joins};
	}

	private getWhereIdObject(id: any) {
		// otherwise, build to object with all of the appropriate id
		const r: any = {};

		const t = typeof id;

		// if to id value is a scalar number/string, then, check and return the appropriate object
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

function completeQueryFilter<E>(query: Knex.QueryBuilder, filter: QueryFilter<E>, table:string) {
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
