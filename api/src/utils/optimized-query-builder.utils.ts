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

interface OptimizedQueryResult {
  baseQuery: string;
  countQuery: string;
  fieldQueries: string[];
}

interface ColumnInfo {
  COLUMN_NAME: string;
}

interface TableExistsResult {
  '1': number;
}

interface QueryRow {
  [key: string]: string | number | null | undefined;
  nid?: number;
  entity_id?: number;
  field_name?: string;
  field_value?: string | number | null;
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
   * Escape an identifier (table/column name) to prevent SQL injection
   * Uses backticks and escapes any backticks in the identifier
   */
  private escapeIdentifier(identifier: string): string {
    // Remove any existing backticks and escape internal ones
    const escaped = identifier.replace(/`/g, '``');
    return `\`${escaped}\``;
  }

  /**
   * Validate that an identifier contains only safe characters
   * (letters, numbers, underscores)
   */
  private isValidIdentifier(identifier: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier);
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

    // Validate contentType to prevent SQL injection
    if (!this.isValidIdentifier(contentType)) {
      throw new Error(`Invalid content type identifier: ${contentType}`);
    }

    // 1. Base query for node data (no JOINs) - using parameterized query
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
      WHERE node.type = ?
      ORDER BY node.nid
    `;

    // 2. Count query (simple, no JOINs) - using parameterized query
    const countQuery = `
      SELECT COUNT(DISTINCT node.nid) as countentry 
      FROM node_field_data node 
      WHERE node.type = ?
    `;

    // 3. Individual field queries (one per field table)
    const fieldQueries: string[] = [];
    
    for (const field of fieldsForType) {
      // Validate field name
      if (!this.isValidIdentifier(field.field_name)) {
        console.warn(`Skipping invalid field name: ${field.field_name}`);
        continue;
      }

      // Check if field table exists and get column structure
      const fieldTableName = `node__${field.field_name}`;
      const escapedTableName = this.escapeIdentifier(fieldTableName);
      
      try {
        // Get field columns dynamically - using parameterized query
        const columnQuery = `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ?
          AND COLUMN_NAME LIKE ?
        `;
        
        const [columns] = await this.connection.promise().query(
          columnQuery, 
          [fieldTableName, `${field.field_name}_%`]
        ) as [ColumnInfo[], unknown];
        
        if (columns.length > 0) {
          // Validate and escape column names
          const validColumns = columns
            .map((col: ColumnInfo) => col.COLUMN_NAME)
            .filter((name: string) => this.isValidIdentifier(name));
          
          if (validColumns.length === 0) {
            console.warn(`No valid columns found for ${fieldTableName}`);
            continue;
          }

          const escapedColumns = validColumns
            .map((name: string) => this.escapeIdentifier(name))
            .join(', ');
          
          // Build field-specific query with escaped identifiers and parameterized value
          const fieldQuery = `
            SELECT 
              entity_id,
              ${escapedColumns}
            FROM ${escapedTableName}
            WHERE entity_id IN (
              SELECT nid FROM node_field_data WHERE type = ?
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

    // Validate contentType to prevent SQL injection
    if (!this.isValidIdentifier(contentType)) {
      throw new Error(`Invalid content type identifier: ${contentType}`);
    }

    // Base query (always the same) - using parameterized query
    const baseQuery = `
      SELECT 
        node.nid, 
        node.title, 
        node.langcode, 
        node.created, 
        node.type
      FROM node_field_data node
      WHERE node.type = ?
      ORDER BY node.nid
    `;

    // Count query - using parameterized query
    const countQuery = `
      SELECT COUNT(DISTINCT node.nid) as countentry 
      FROM node_field_data node 
      WHERE node.type = ?
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
        // Validate field name
        if (!this.isValidIdentifier(field.field_name)) {
          console.warn(`Skipping invalid field name: ${field.field_name}`);
          continue;
        }

        try {
          const fieldTableName = `node__${field.field_name}`;
          const escapedTableName = this.escapeIdentifier(fieldTableName);
          
          // Check if table exists - using parameterized query
          const tableExistsQuery = `
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = ?
          `;
          
          const [tableExists] = await this.connection.promise().query(
            tableExistsQuery,
            [fieldTableName]
          ) as [TableExistsResult[], unknown];
          
          if (tableExists.length > 0) {
            // Get field columns - using parameterized query
            const columnQuery = `
              SELECT COLUMN_NAME 
              FROM INFORMATION_SCHEMA.COLUMNS 
              WHERE TABLE_SCHEMA = DATABASE() 
              AND TABLE_NAME = ?
              AND COLUMN_NAME LIKE ?
              LIMIT 1
            `;
            
            const [columns] = await this.connection.promise().query(
              columnQuery,
              [fieldTableName, `${field.field_name}_%`]
            ) as [ColumnInfo[], unknown];
            
            if (columns.length > 0) {
              const columnName = columns[0].COLUMN_NAME;
              
              // Validate column name
              if (!this.isValidIdentifier(columnName)) {
                console.warn(`Skipping invalid column name: ${columnName}`);
                continue;
              }
              
              const escapedColumnName = this.escapeIdentifier(columnName);
              validFields.push(`MAX(${escapedTableName}.${escapedColumnName}) as ${escapedColumnName}`);
              joinClauses.push(`LEFT JOIN ${escapedTableName} ON ${escapedTableName}.entity_id = node.nid`);
            }
          }
        } catch (error) {
          console.warn(`Skipping field ${field.field_name}:`, error);
        }
      }

      if (validFields.length > 0) {
        // Build batch query with escaped identifiers and parameterized value placeholder
        const batchQuery = `
          SELECT 
            node.nid,
            ${validFields.join(',\n            ')}
          FROM node_field_data node
          ${joinClauses.join('\n          ')}
          WHERE node.type = ?
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

    // Validate contentType to prevent SQL injection
    if (!this.isValidIdentifier(contentType)) {
      throw new Error(`Invalid content type identifier: ${contentType}`);
    }

    // Base query - using parameterized query
    const baseQuery = `
      SELECT 
        node.nid, 
        node.title, 
        node.langcode, 
        node.created, 
        node.type
      FROM node_field_data node
      WHERE node.type = ?
      ORDER BY node.nid
    `;

    // Count query - using parameterized query
    const countQuery = `
      SELECT COUNT(DISTINCT node.nid) as countentry 
      FROM node_field_data node 
      WHERE node.type = ?
    `;

    // Union query for all field data
    const unionParts: string[] = [];
    
    for (const field of fieldsForType) {
      // Validate field name
      if (!this.isValidIdentifier(field.field_name)) {
        console.warn(`Skipping invalid field name in union: ${field.field_name}`);
        continue;
      }

      const fieldTableName = `node__${field.field_name}`;
      const escapedTableName = this.escapeIdentifier(fieldTableName);
      const escapedFieldName = this.escapeIdentifier(field.field_name);
      
      try {
        // Get field columns - using parameterized query
        const columnQuery = `
          SELECT COLUMN_NAME 
          FROM INFORMATION_SCHEMA.COLUMNS 
          WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ?
          AND COLUMN_NAME LIKE ?
          LIMIT 1
        `;
        
        const [columns] = await this.connection.promise().query(
          columnQuery,
          [fieldTableName, `${field.field_name}_%`]
        ) as [ColumnInfo[], unknown];
        
        if (columns.length > 0) {
          const columnName = columns[0].COLUMN_NAME;
          
          // Validate column name
          if (!this.isValidIdentifier(columnName)) {
            console.warn(`Skipping invalid column name in union: ${columnName}`);
            continue;
          }
          
          const escapedColumnName = this.escapeIdentifier(columnName);
          
          // Use escaped identifiers and parameterized query placeholder
          unionParts.push(`
            SELECT 
              entity_id as nid,
              ${escapedFieldName} as field_name,
              ${escapedColumnName} as field_value
            FROM ${escapedTableName}
            WHERE entity_id IN (
              SELECT nid FROM node_field_data WHERE type = ?
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
  ): Promise<QueryRow[]> {
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const message = getLogMessage(
        srcFunc,
        `Failed to execute optimized queries for ${contentType}: ${errorMessage}`,
        {},
        error
      );
      await customLogger(this.projectId, this.destinationStackId, 'error', message);
      throw error;
    }
  }

  private async executeSequentialQueries(contentType: string, fieldsForType: DrupalFieldData[]): Promise<QueryRow[]> {
    const { baseQuery, fieldQueries } = await this.generateSequentialQueries(contentType, fieldsForType);
    
    // Execute base query with contentType parameter
    const [baseResults] = await this.connection.promise().query(baseQuery, [contentType]) as [QueryRow[], unknown];
    
    // Create result map
    const resultMap = new Map<number, QueryRow>();
    if (baseResults && Array.isArray(baseResults)) {
      baseResults.forEach((row: QueryRow) => {
        if (row?.nid) {
          resultMap.set(row.nid, { ...row });
        }
      });
    }

    // Execute field queries and merge results
    // Each field query has one ? placeholder for contentType
    for (const fieldQuery of fieldQueries) {
      const [fieldResults] = await this.connection.promise().query(fieldQuery, [contentType]) as [QueryRow[], unknown];
      
      if (fieldResults && Array.isArray(fieldResults)) {
        fieldResults.forEach((fieldRow: QueryRow) => {
          const nid = fieldRow?.entity_id;
          if (nid && resultMap.has(nid)) {
            const existingRow = resultMap.get(nid);
            if (existingRow) {
              // Merge field data (exclude entity_id)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { entity_id: _entityId, ...fieldData } = fieldRow;
              Object.assign(existingRow, fieldData);
            }
          }
        });
      }
    }

    return Array.from(resultMap.values());
  }

  private async executeBatchedQueries(contentType: string, fieldsForType: DrupalFieldData[], batchSize: number): Promise<QueryRow[]> {
    const { baseQuery, batchQueries } = await this.generateBatchedQueries(contentType, fieldsForType, batchSize);
    
    // Execute base query with contentType parameter
    const [baseResults] = await this.connection.promise().query(baseQuery, [contentType]) as [QueryRow[], unknown];
    
    // Create result map
    const resultMap = new Map<number, QueryRow>();
    if (baseResults && Array.isArray(baseResults)) {
      baseResults.forEach((row: QueryRow) => {
        if (row?.nid) {
          resultMap.set(row.nid, { ...row });
        }
      });
    }

    // Execute batch queries and merge results
    // Each batch query has one ? placeholder for contentType
    for (const batchQuery of batchQueries) {
      const [batchResults] = await this.connection.promise().query(batchQuery, [contentType]) as [QueryRow[], unknown];
      
      if (batchResults && Array.isArray(batchResults)) {
        batchResults.forEach((batchRow: QueryRow) => {
          const nid = batchRow?.nid;
          if (nid && resultMap.has(nid)) {
            const existingRow = resultMap.get(nid);
            if (existingRow) {
              // Merge batch data (exclude nid)
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { nid: _nid, ...batchData } = batchRow;
              Object.assign(existingRow, batchData);
            }
          }
        });
      }
    }

    return Array.from(resultMap.values());
  }

  private async executeUnionQueries(contentType: string, fieldsForType: DrupalFieldData[]): Promise<QueryRow[]> {
    const { baseQuery, unionQuery } = await this.generateUnionQueries(contentType, fieldsForType);
    
    // Execute base query with contentType parameter
    const [baseResults] = await this.connection.promise().query(baseQuery, [contentType]) as [QueryRow[], unknown];
    
    // Create result map
    const resultMap = new Map<number, QueryRow>();
    if (baseResults && Array.isArray(baseResults)) {
      baseResults.forEach((row: QueryRow) => {
        if (row?.nid) {
          resultMap.set(row.nid, { ...row });
        }
      });
    }

    // Execute union query if it exists
    if (unionQuery) {
      // Count the number of ? placeholders in the union query
      // Each field in the union has one ? for contentType
      const placeholderCount = (unionQuery.match(/\?/g) || []).length;
      const unionParams = Array(placeholderCount).fill(contentType);
      
      const [unionResults] = await this.connection.promise().query(unionQuery, unionParams) as [QueryRow[], unknown];
      
      // Group union results by nid
      if (unionResults && Array.isArray(unionResults)) {
        unionResults.forEach((unionRow: QueryRow) => {
          const nid = unionRow?.nid;
          const fieldName = unionRow?.field_name;
          if (nid && fieldName && resultMap.has(nid)) {
            const existingRow = resultMap.get(nid);
            if (existingRow) {
              existingRow[fieldName] = unionRow.field_value;
            }
          }
        });
      }
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
