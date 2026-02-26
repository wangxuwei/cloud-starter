// <origin src="services/_common/src/da/dao-ticket.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// Ticket DAO with relationship configuration example
////

import { OrgScopedDao } from './dao-org-scoped.js';
import { RelationshipConfig } from './include-utils.js';
import { projectDao } from './dao-project.js';
import { userDao } from './dao-user.js';

export const TICKET_COLUMNS = Object.freeze([
  'id', 'title', 'status', 'priority', 'projectId', 'assigneeId'
] as const);

export class TicketDao extends OrgScopedDao {
  constructor() {
    super({
      table: 'ticket',
      stamped: true,
      columns: TICKET_COLUMNS
    });
  }

  protected getIncludeProcessorOptions() {
    const baseOptions = super.getIncludeProcessorOptions();
    return {
      ...baseOptions,
      relationships: {
        project: {
          type: 'belongsTo',
          targetTable: 'project',
          foreignKey: 'projectId',
          targetKey: 'id',
          as: 'project',
          targetColumns: ['id', 'name', 'description'],
          targetStamped: true
        },
        assignee: {
          type: 'belongsTo',
          targetTable: 'user',
          foreignKey: 'assigneeId',
          targetKey: 'id',
          as: 'assignee',
          targetColumns: ['id', 'username', 'fullName', 'email'],
          targetStamped: false
        }
      }
    };
  }

  protected getRelatedDao(relation: string) {
    if (relation === 'project') return projectDao;
    if (relation === 'assignee') return userDao;
    return null;
  }
}
