// <origin src="services/_common/src/da/records/ticket-rec.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// Ticket record definition and utilities
////

import { BaseRecord } from './bases.js';

export interface TicketRec extends BaseRecord {
  title: string;
  status: string;
  priority: string;
  projectId?: number;
  assigneeId?: number;
  description?: string;
}

export const TICKET_DEFAULTS = {
  title: '',
  status: 'open',
  priority: 'normal',
} as const;

export const parseTicketRecord = (rec: any): TicketRec => {
  return {
    id: rec.id,
    title: rec.title || TICKET_DEFAULTS.title,
    status: rec.status || TICKET_DEFAULTS.status,
    priority: rec.priority || TICKET_DEFAULTS.priority,
    projectId: rec.projectId,
    assigneeId: rec.assigneeId,
    description: rec.description,
    cid: rec.cid,
    ctime: rec.ctime,
    mid: rec.mid,
    mtime: rec.mtime,
  };
};
