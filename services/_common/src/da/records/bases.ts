import { StampedEntity } from '../../../../../shared/src/entities-base';

const { freeze } = Object;

export const TIMESTAMPS_COLUMNS = freeze(['cid', 'ctime', 'mid', 'mtime']);

export interface TimestampedRec extends StampedEntity { }

/**
 * Base interface for Record that have orgId
 */
export interface OrgedRec {
  orgId: number
}