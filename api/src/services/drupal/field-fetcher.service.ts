import mysql from 'mysql2';
import { getLogMessage } from '../../utils/index.js';
import customLogger from '../../utils/custom-logger.utils.js';

/**
 * Field Fetcher Service for Content Types with Many Fields
 * Handles field data fetching for content types that exceed MySQL JOIN limits
 */

interface DrupalFieldData {
  field_name: string;
  content_types: string;
  type: string;
  content_handler?: string;
}

interface FieldDataResult {
  [nid: number]: {
    [fieldName: string]: any;
  };
}

export class FieldFetcherService {
  private connection: mysql.Connection;
  private projectId: string;
  private destinationStackId: string;

  constructor(connection: mysql.Connection, projectId: string, destinationStackId: string) {
    this.connection = connection;
    this.projectId = projectId;
    this.destinationStackId = destinationStackId;
  }

  /**
   * Fetch field data for content types with many fields using individual queries
   * This avoids the MySQL 61-table JOIN limit
   */
  async fetchFieldDataForContentType(
    contentType: string,
    nodeIds: number[],
    fieldsForType: DrupalFieldData[]
  ): Promise<FieldDataResult> {
    const srcFunc = 'fetchFieldDataForContentType';
    const fieldData: FieldDataResult = {};

    if (nodeIds.length === 0) {
      return fieldData;
    }

    // Initialize field data structure
    nodeIds.forEach(nid => {
      fieldData[nid] = {};
    });

    const message = getLogMessage(
      srcFunc,
      `Fetching field data for ${contentType}: ${fieldsForType.length} fields, ${nodeIds.length} nodes`,
      {}
    );
    await customLogger(this.projectId, this.destinationStackId, 'info', message);

    // Process fields in batches to avoid overwhelming the database
    const batchSize = 10;
    for (let i = 0; i < fieldsForType.length; i += batchSize) {
      const fieldBatch = fieldsForType.slice(i, i + batchSize);
      
      await Promise.all(
        fieldBatch.map(field => this.fetchSingleFieldData(field, nodeIds, fieldData))
      );
    }

    const successMessage = getLogMessage(
      srcFunc,
      `Successfully fetched field data for ${contentType}: ${Object.keys(fieldData).length} nodes processed`,
      {}
    );
    await customLogger(this.projectId, this.destinationStackId, 'info', successMessage);

    return fieldData;
  }

  /**
   * Fetch data for a single field across multiple nodes
   */
  private async fetchSingleFieldData(
    field: DrupalFieldData,
    nodeIds: number[],
    fieldData: FieldDataResult
  ): Promise<void> {
    const fieldTableName = `node__${field.field_name}`;
    
    try {
      // Check if field table exists
      const tableExistsQuery = `
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        LIMIT 1
      `;
      
      const [tableExists] = await this.connection.promise().query(tableExistsQuery, [fieldTableName]) as any[];
      
      if (tableExists.length === 0) {
        console.warn(`Field table ${fieldTableName} does not exist`);
        return;
      }

      // Get field columns dynamically
      const columnQuery = `
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = ?
        AND COLUMN_NAME LIKE ?
      `;
      
      const [columns] = await this.connection.promise().query(columnQuery, [fieldTableName, `${field.field_name}_%`]) as any[];
      
      if (columns.length === 0) {
        console.warn(`No columns found for field ${field.field_name}`);
        return;
      }

      // Build field query with all relevant columns
      const fieldColumns = columns.map((col: any) => col.COLUMN_NAME);
      const selectColumns = fieldColumns.join(', ');
      
      const fieldQuery = `
        SELECT 
          entity_id,
          ${selectColumns}
        FROM ${fieldTableName}
        WHERE entity_id IN (${nodeIds.map(() => '?').join(',')})
      `;

      const [fieldResults] = await this.connection.promise().query(fieldQuery, nodeIds) as any[];

      // Merge field results into main data structure
      fieldResults.forEach((row: any) => {
        const nid = row.entity_id;
        if (fieldData[nid]) {
          // Add all field columns to the node data
          fieldColumns.forEach((columnName: string) => {
            if (row[columnName] !== null && row[columnName] !== undefined) {
              fieldData[nid][columnName] = row[columnName];
            }
          });
        }
      });

    } catch (error: any) {
      console.warn(`Error fetching data for field ${field.field_name}:`, error.message);
      
      const errorMessage = getLogMessage(
        'fetchSingleFieldData',
        `Failed to fetch data for field ${field.field_name}: ${error.message}`,
        {},
        error
      );
      await customLogger(this.projectId, this.destinationStackId, 'warn', errorMessage);
    }
  }

  /**
   * Merge base node data with field data
   */
  mergeNodeAndFieldData(
    baseNodes: any[],
    fieldData: FieldDataResult
  ): any[] {
    return baseNodes.map(node => {
      const nid = node.nid;
      const nodeFieldData = fieldData[nid] || {};
      
      return {
        ...node,
        ...nodeFieldData
      };
    });
  }

  /**
   * Get field configuration for a content type
   */
  async getFieldsForContentType(contentType: string): Promise<DrupalFieldData[]> {
    const configQuery = `
      SELECT *, CONVERT(data USING utf8) as data 
      FROM config 
      WHERE name LIKE '%field.field.node%'
    `;

    try {
      const [rows] = await this.connection.promise().query(configQuery) as any[];
      const fields: DrupalFieldData[] = [];

      for (const row of rows) {
        try {
          const { unserialize } = await import('php-serialize');
          const configData = unserialize(row.data);
          
          if (configData && configData.bundle === contentType) {
            fields.push({
              field_name: configData.field_name,
              content_types: configData.bundle,
              type: configData.field_type,
              content_handler: configData?.settings?.handler
            });
          }
        } catch (parseError) {
          console.warn(`Failed to parse field config for ${row.name}:`, parseError);
        }
      }

      return fields;
    } catch (error: any) {
      const errorMessage = getLogMessage(
        'getFieldsForContentType',
        `Failed to get fields for content type ${contentType}: ${error.message}`,
        {},
        error
      );
      await customLogger(this.projectId, this.destinationStackId, 'error', errorMessage);
      throw error;
    }
  }
}

export default FieldFetcherService;
