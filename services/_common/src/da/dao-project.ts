// <origin src="services/_common/src/da/dao-project.ts" />
// (c) 2024 BriteSnow, inc - This code is licensed under MIT license (for details see LICENSE)

/////////////////////
// Project DAO
////

import { Project } from '#shared/entities.js';
import { OrgScopedDao } from './dao-org-scoped.js';
import { wksDao } from './daos.js';

// Default columns for Project entity
export const PROJECT_COLUMNS = Object.freeze([
  'id', 'name', 'description', 'wksId'
] as const);

export class ProjectDao extends OrgScopedDao<Project, number> {
  constructor() { 
    super({ 
      table: 'project', 
      stamped: true,
      columns: PROJECT_COLUMNS
    }) 
  }

  protected getIncludeProcessorOptions() {
    const baseOptions = super.getIncludeProcessorOptions();
    return {
      ...baseOptions,
      // Add custom column groups specific to projects
      columnGroups: {
        ...baseOptions.columnGroups,
        _projectInfo: ['id', 'name', 'wksId'],
        _details: ['id', 'name', 'description']
      },
      // Define workspace relationship for nested includes
      relationships: {
        workspace: {
          type: 'belongsTo',
          targetTable: 'workspace',
          foreignKey: 'wksId',
          targetKey: 'id',
          as: 'workspace',
          targetColumns: ['id', 'name'],
          targetColumnGroups: {
            _defaults: ['id', 'name']
          },
          targetStamped: true
        }
      }
    };
  }

  protected getRelatedDao(relation: string) {
    if (relation === 'workspace') {
      return wksDao;
    }
    return null;
  }
}
