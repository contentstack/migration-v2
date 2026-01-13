import mysql from 'mysql2';
import { getLogMessage } from './index.js';
import customLogger from './custom-logger.utils.js';

/**
 * Optimized Query Builder for Drupal Field Data
 * Eliminates the 61-table JOIN limit by using sequential queries
 */

interface DrupalFieldData {
  field_name: string;
  content_types: string;
  type: string;
  content_handler?: string;
}

interface FieldResult {
  entity_id: number;
  [key: string]: any;
}

interface OptimizedQueryResult {
  baseQuery: string;
  countQuery: string;
  fieldQueries: string[];
}

export class OptimizedQueryBuilder {
  private connection: mysql.Connection;
  private projectId: string;
  private destinationStackId: string;

  constructor(connection: mysql.Connection, projectId: string, destinationStackId: string) {
    this.connection = connection;
    this.projectId = projectId;
    this.destinationStackId = destinationStackId;
  }

  /**
   * Strategy 1: Sequential Field Queries (No JOINs)
   * Fetch base node data first, then field data separately
   */
  async generateSequentialQueries(
    contentType: string, 
    fieldsForType: DrupalFieldData[]
  ): Promise<OptimizedQueryResult> {
    const srcFunc = 'generateSequentialQueries';

    // 1. Base query for node data (no JOINs)
    const baseQuery = `
      SELECT 
        node.nid, 
        node.title, 
        node.langcode, 
        node.created, 
        node.type,
        users.name as author_name
      FROM node_field_data node
      LEFT JOIN users ON users.uid = node.uid
      WHERE node.type = '${contentType}'
      ORDER BY node.nid
    `;

    // 2. Count query (simple, no JOINs)
    const countQuery = `
      SELECT COUNT(DISTINCT node.nid) as countentry 
      FROM node_field_data node 
      WHERE node.type = '${contentType}'
    `;

    // 3. Individual field queries (one per field table)
    const fieldQueries: string[] = [];
    
    for (const field of fieldsForType) {
      // Check if field table exists and get column structure
      const fieldTableName = `node__${field.field_name}`;
      
      try {
        // Get field columns dynamically
        const columnQuery = `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = '${fieldTableName}'
          AND COLUMN_NAME LIKE '${field.field_name}_%'
        `;
        
        const [columns] = await this.connection.promise().query(columnQuery) as any[];
        
        if (columns.length > 0) {
          // Build field-specific query
          const fieldColumns = columns.map((col: any) => col.COLUMN_NAME).join(', ');
          
          const fieldQuery = `
            SELECT 
              entity_id,
              ${fieldColumns}
            FROM ${fieldTableName}
            WHERE entity_id IN (
              SELECT nid FROM node_field_data WHERE type = '${contentType}'
            )
          `;
          
          fieldQueries.push(fieldQuery);
        }
      } catch (error) {
        console.warn(`Field table ${fieldTableName} not found or inaccessible:`, error);
      }
    }

    const message = getLogMessage(
      srcFunc,
      `Generated optimized queries for ${contentType}: 1 base + ${fieldQueries.length} field queries (0 JOINs)`,
      {}
    );
    await customLogger(this.projectId, this.destinationStackId, 'info', message);

    return {
      baseQuery,
      countQuery,
      fieldQueries
    };
  }

  /**
   * Strategy 2: Batch Field Queries (Limited JOINs)
   * Group fields into batches with max 15 JOINs each
   */
  async generateBatchedQueries(
    contentType: string, 
    fieldsForType: DrupalFieldData[],
    batchSize: number = 15
  ): Promise<{ baseQuery: string; batchQueries: string[]; countQuery: string }> {
    const srcFunc = 'generateBatchedQueries';

    // Base query (always the same)
    const baseQuery = `
      SELECT 
        node.nid, 
        node.title, 
        node.langcode, 
        node.created, 
        node.type
      FROM node_field_data node
      WHERE node.type = '${contentType}'
      ORDER BY node.nid
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT node.nid) as countentry 
      FROM node_field_data node 
      WHERE node.type = '${contentType}'
    `;

    // Create batches of fields
    const fieldBatches = this.createFieldBatches(fieldsForType, batchSize);
    const batchQueries: string[] = [];

    for (let i = 0; i < fieldBatches.length; i++) {
      const batch = fieldBatches[i];
      const validFields: string[] = [];
      const joinClauses: string[] = [];

      // Validate each field in the batch
      for (const field of batch) {
        try {
          const fieldTableName = `node__${field.field_name}`;
          
          // Check if table exists
          const tableExistsQuery = `
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = '${fieldTableName}'
          `;
          
          const [tableExists] = await this.connection.promise().query(tableExistsQuery) as any[];
          
          if (tableExists.length > 0) {
            // Get field columns
            const columnQuery = `
              SELECT COLUMN_NAME 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = '${fieldTableName}'
              AND COLUMN_NAME LIKE '${field.field_name}_%'
              LIMIT 1
            `;
            
            const [columns] = await this.connection.promise().query(columnQuery) as any[];
            
            if (columns.length > 0) {
              const columnName = columns[0].COLUMN_NAME;
              validFields.push(`MAX(${fieldTableName}.${columnName}) as ${columnName}`);
              joinClauses.push(`LEFT JOIN ${fieldTableName} ON ${fieldTableName}.entity_id = node.nid`);
            }
          }
        } catch (error) {
          console.warn(`Skipping field ${field.field_name}:`, error);
        }
      }

      if (validFields.length > 0) {
        const batchQuery = `
          SELECT 
            node.nid,
            ${validFields.join(',\n            ')}
          FROM node_field_data node
          ${joinClauses.join('\n          ')}
          WHERE node.type = '${contentType}'
          GROUP BY node.nid
          ORDER BY node.nid
        `;
        
        batchQueries.push(batchQuery);
      }
    }

    const message = getLogMessage(
      srcFunc,
      `Generated ${batchQueries.length} batched queries for ${contentType} (max ${batchSize} JOINs each)`,
      {}
    );
    await customLogger(this.projectId, this.destinationStackId, 'info', message);

    return {
      baseQuery,
      batchQueries,
      countQuery
    };
  }

  /**
   * Strategy 3: Union-Based Field Queries
   * Use UNION to combine field data without JOINs
   */
  async generateUnionQueries(
    contentType: string, 
    fieldsForType: DrupalFieldData[]
  ): Promise<{ baseQuery: string; unionQuery: string; countQuery: string }> {
    const srcFunc = 'generateUnionQueries';

    // Base query
    const baseQuery = `
      SELECT 
        node.nid, 
        node.title, 
        node.langcode, 
        node.created, 
        node.type
      FROM node_field_data node
      WHERE node.type = '${contentType}'
      ORDER BY node.nid
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT node.nid) as countentry 
      FROM node_field_data node 
      WHERE node.type = '${contentType}'
    `;

    // Union query for all field data
    const unionParts: string[] = [];
    
    for (const field of fieldsForType) {
      const fieldTableName = `node__${field.field_name}`;
      
      try {
        // Get field columns
        const columnQuery = `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = '${fieldTableName}'
          AND COLUMN_NAME LIKE '${field.field_name}_%'
          LIMIT 1
        `;
        
        const [columns] = await this.connection.promise().query(columnQuery) as any[];
        
        if (columns.length > 0) {
          const columnName = columns[0].COLUMN_NAME;
          
          unionParts.push(`
            SELECT 
              entity_id as nid,
              '${field.field_name}' as field_name,
              ${columnName} as field_value
            FROM ${fieldTableName}
            WHERE entity_id IN (
              SELECT nid FROM node_field_data WHERE type = '${contentType}'
            )
          `);
        }
      } catch (error) {
        console.warn(`Skipping field ${field.field_name} in union:`, error);
      }
    }

    const unionQuery = unionParts.length > 0 ? unionParts.join('\nUNION ALL\n') : '';

    const message = getLogMessage(
      srcFunc,
      `Generated union query for ${contentType} with ${unionParts.length} field parts`,
      {}
    );
    await customLogger(this.projectId, this.destinationStackId, 'info', message);

    return {
      baseQuery,
      unionQuery,
      countQuery
    };
  }

  /**
   * Execute optimized queries and merge results
   */
  async executeOptimizedQueries(
    strategy: 'sequential' | 'batched' | 'union',
    contentType: string,
    fieldsForType: DrupalFieldData[],
    batchSize: number = 15
  ): Promise<any[]> {
    const srcFunc = 'executeOptimizedQueries';

    try {
      switch (strategy) {
        case 'sequential':
          return await this.executeSequentialQueries(contentType, fieldsForType);
        
        case 'batched':
          return await this.executeBatchedQueries(contentType, fieldsForType, batchSize);
        
        case 'union':
          return await this.executeUnionQueries(contentType, fieldsForType);
        
        default:
          throw new Error(`Unknown strategy: ${strategy}`);
      }
    } catch (error: any) {
      const message = getLogMessage(
        srcFunc,
        `Failed to execute optimized queries for ${contentType}: ${error.message}`,
        {},
        error
      );
      await customLogger(this.projectId, this.destinationStackId, 'error', message);
      throw error;
    }
  }

  private async executeSequentialQueries(contentType: string, fieldsForType: DrupalFieldData[]): Promise<any[]> {
    const { baseQuery, fieldQueries } = await this.generateSequentialQueries(contentType, fieldsForType);
    
    // Execute base query
    const [baseResults] = await this.connection.promise().query(baseQuery) as any[];
    
    // Create result map
    const resultMap = new Map();
    baseResults.forEach((row: any) => {
      resultMap.set(row.nid, { ...row });
    });

    // Execute field queries and merge results
    for (const fieldQuery of fieldQueries) {
      const [fieldResults] = await this.connection.promise().query(fieldQuery) as any[];
      
      fieldResults.forEach((fieldRow: any) => {
        const nid = fieldRow.entity_id;
        if (resultMap.has(nid)) {
          const existingRow = resultMap.get(nid);
          // Merge field data (exclude entity_id)
          const { entity_id, ...fieldData } = fieldRow;
          Object.assign(existingRow, fieldData);
        }
      });
    }

    return Array.from(resultMap.values());
  }

  private async executeBatchedQueries(contentType: string, fieldsForType: DrupalFieldData[], batchSize: number): Promise<any[]> {
    const { baseQuery, batchQueries } = await this.generateBatchedQueries(contentType, fieldsForType, batchSize);
    
    // Execute base query
    const [baseResults] = await this.connection.promise().query(baseQuery) as any[];
    
    // Create result map
    const resultMap = new Map();
    baseResults.forEach((row: any) => {
      resultMap.set(row.nid, { ...row });
    });

    // Execute batch queries and merge results
    for (const batchQuery of batchQueries) {
      const [batchResults] = await this.connection.promise().query(batchQuery) as any[];
      
      batchResults.forEach((batchRow: any) => {
        const nid = batchRow.nid;
        if (resultMap.has(nid)) {
          const existingRow = resultMap.get(nid);
          // Merge batch data (exclude nid)
          const { nid: _, ...batchData } = batchRow;
          Object.assign(existingRow, batchData);
        }
      });
    }

    return Array.from(resultMap.values());
  }

  private async executeUnionQueries(contentType: string, fieldsForType: DrupalFieldData[]): Promise<any[]> {
    const { baseQuery, unionQuery } = await this.generateUnionQueries(contentType, fieldsForType);
    
    // Execute base query
    const [baseResults] = await this.connection.promise().query(baseQuery) as any[];
    
    // Create result map
    const resultMap = new Map();
    baseResults.forEach((row: any) => {
      resultMap.set(row.nid, { ...row });
    });

    // Execute union query if it exists
    if (unionQuery) {
      const [unionResults] = await this.connection.promise().query(unionQuery) as any[];
      
      // Group union results by nid
      unionResults.forEach((unionRow: any) => {
        const nid = unionRow.nid;
        if (resultMap.has(nid)) {
          const existingRow = resultMap.get(nid);
          existingRow[unionRow.field_name] = unionRow.field_value;
        }
      });
    }

    return Array.from(resultMap.values());
  }

  private createFieldBatches(fields: DrupalFieldData[], batchSize: number): DrupalFieldData[][] {
    const batches: DrupalFieldData[][] = [];
    for (let i = 0; i < fields.length; i += batchSize) {
      batches.push(fields.slice(i, i + batchSize));
    }
    return batches;
  }
}

export default OptimizedQueryBuilder;
