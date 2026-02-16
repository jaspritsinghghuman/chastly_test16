// ============================================
// Database Plugin
// PostgreSQL connection pool with query helpers
// ============================================

import fp from 'fastify-plugin';
import { Pool, PoolClient, QueryResult } from 'pg';
import { config } from '../config/index.js';
import { dbLogger } from '../utils/logger.js';

// Database connection pool
const pool = new Pool({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  user: config.database.user,
  password: config.database.password,
  ssl: config.database.ssl ? { rejectUnauthorized: false } : false,
  max: config.database.maxConnections,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis,
});

// Connection event handlers
pool.on('connect', () => {
  dbLogger.debug('New database connection established');
});

pool.on('error', (err) => {
  dbLogger.error({ err }, 'Unexpected database error');
});

// Query helper with logging
export async function query<T = any>(
  sql: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const result = await pool.query<T>(sql, params);
    const duration = Date.now() - start;
    dbLogger.debug({ sql: sql.slice(0, 100), duration, rows: result.rowCount }, 'Query executed');
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    dbLogger.error({ sql: sql.slice(0, 100), duration, error }, 'Query failed');
    throw error;
  }
}

// Transaction helper
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Get a single row
export async function queryOne<T = any>(
  sql: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(sql, params);
  return result.rows[0] || null;
}

// Get multiple rows
export async function queryMany<T = any>(
  sql: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(sql, params);
  return result.rows;
}

// Insert and return the inserted row
export async function insert<T = any>(
  table: string,
  data: Record<string, any>,
  returning: string = '*'
): Promise<T> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING ${returning}`;
  const result = await query<T>(sql, values);
  return result.rows[0];
}

// Update and return the updated row
export async function update<T = any>(
  table: string,
  id: string,
  data: Record<string, any>,
  returning: string = '*'
): Promise<T | null> {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');

  const sql = `UPDATE ${table} SET ${setClause}, updated_at = NOW() WHERE id = $${values.length + 1} RETURNING ${returning}`;
  const result = await query<T>(sql, [...values, id]);
  return result.rows[0] || null;
}

// Soft delete
export async function softDelete(
  table: string,
  id: string
): Promise<boolean> {
  const sql = `UPDATE ${table} SET deleted_at = NOW(), status = 'deleted' WHERE id = $1`;
  const result = await query(sql, [id]);
  return (result.rowCount || 0) > 0;
}

// Hard delete
export async function hardDelete(
  table: string,
  id: string
): Promise<boolean> {
  const sql = `DELETE FROM ${table} WHERE id = $1`;
  const result = await query(sql, [id]);
  return (result.rowCount || 0) > 0;
}

// Build paginated query
export interface PaginationOptions {
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export function buildPaginatedQuery(
  baseQuery: string,
  options: PaginationOptions,
  params: any[] = []
): { query: string; countQuery: string; params: any[] } {
  const page = Math.max(1, options.page || 1);
  const limit = Math.min(100, Math.max(1, options.limit || 20));
  const offset = (page - 1) * limit;
  const orderBy = options.orderBy || 'created_at';
  const orderDirection = options.orderDirection || 'DESC';

  const query = `${baseQuery} ORDER BY ${orderBy} ${orderDirection} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const countQuery = `SELECT COUNT(*) FROM (${baseQuery}) AS count_query`;

  return {
    query,
    countQuery,
    params: [...params, limit, offset],
  };
}

// Database plugin
export const databasePlugin = fp(async (fastify) => {
  // Test connection
  try {
    await pool.query('SELECT NOW()');
    dbLogger.info('Database connected successfully');
  } catch (error) {
    dbLogger.error({ error }, 'Failed to connect to database');
    throw error;
  }

  // Decorate fastify with database helpers
  fastify.decorate('db', {
    query,
    queryOne,
    queryMany,
    insert,
    update,
    softDelete,
    hardDelete,
    transaction,
    pool,
  });

  // Close pool on shutdown
  fastify.addHook('onClose', async () => {
    await pool.end();
    dbLogger.info('Database pool closed');
  });
});

// Type declarations
declare module 'fastify' {
  interface FastifyInstance {
    db: {
      query: typeof query;
      queryOne: typeof queryOne;
      queryMany: typeof queryMany;
      insert: typeof insert;
      update: typeof update;
      softDelete: typeof softDelete;
      hardDelete: typeof hardDelete;
      transaction: typeof transaction;
      pool: Pool;
    };
  }
}
