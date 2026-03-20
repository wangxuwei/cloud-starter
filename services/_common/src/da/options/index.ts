import { QueryOptions } from "#shared/query_options.js";
import { Knex } from "knex";
import { UserContext } from "../../user-context.js";
import { ensureArray } from "../../utils.js";
import { CustomQuery } from "../dao-base.js";
import { completeQueryFilter } from "./filter/index.js";
import {
  IncludeProcessorOptions,
  processIncludes,
} from "./include/processor.js";
import {
  buildBelongsJoinToQuery,
  buildMainAndRelationColumns,
  loadNestEntity,
  parseNestRecord,
  removeIdsIfNeed,
} from "./include/query.js";

export function buildQueryByQueryOptions<
  E,
  Q extends QueryOptions<E> = QueryOptions<E>
>(
  query: Knex.QueryBuilder,
  entity: string,
  queryOptions?: Q & CustomQuery,
  defaultColumns?: string[],
  defaultOrderBy?: string | null
): IncludeProcessorOptions | undefined {
  const alias = "main";

  const includes = queryOptions?.includes;
  // if this dao has a fixed column.
  if (defaultColumns && !includes) {
    query.columns(defaultColumns);
  }
  let includeOptions: IncludeProcessorOptions | undefined = undefined;

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
    if (includes) {
      // Use buildIncludeProcessorOptions to get the complete options with targetColumns map
      const entityKey = entity;
      includeOptions = processIncludes(includes, entityKey, alias);

      // Build main table columns and relation columns with proper aliases
      buildMainAndRelationColumns(query, includeOptions);

      // Build JOINs and nested configs for all belongsTo relationships
      if (includeOptions.relationships) {
        buildBelongsJoinToQuery(query, includeOptions);
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
    let orderBy =
      queryOptions.list_options?.order_bys !== undefined
        ? queryOptions.list_options?.order_bys
        : defaultOrderBy;
    if (orderBy) {
      const orderBys = ensureArray(orderBy);
      for (const orderByColExpr of orderBys) {
        let asc = true;
        let orderByCol = orderByColExpr;
        if (orderByColExpr.startsWith("!")) {
          asc = false;
          orderByCol = orderByColExpr.substring(1);
        }
        query.orderBy(orderByCol, asc ? "ASC" : "DESC");
      }
    }
  }

  return includeOptions;
}

export async function parsedRecordsByQueryOptions<E>(
  utx: UserContext,
  records: E[],
  includeOptions?: IncludeProcessorOptions,
  extraParseCallback?: (recs: E[]) => E[]
): Promise<E[]> {
  // Parse nested records from JOINed tables
  if (includeOptions) {
    const parsedRecords = records.map((r) =>
      parseNestRecord(r, includeOptions)
    );
    let entities = parsedRecords;
    if (extraParseCallback) {
      entities = extraParseCallback(parsedRecords);
    }

    // Load nested entities for hasMany/hasOne relationships
    await loadNestEntity(utx, entities, includeOptions);
    removeIdsIfNeed(entities, includeOptions);
    return entities;
  } else {
    let entities = records;
    if (extraParseCallback) {
      entities = extraParseCallback(records);
    }
    return entities;
  }
}
