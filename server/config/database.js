const { Pool } = require('pg');
const logger = require('../utils/logger');

// Validate DB_URL is set
if (!process.env.DB_URL) {
  logger.error('❌ DB_URL environment variable is not set');
  throw new Error('DB_URL environment variable is required');
}

// Determine if we're using Supabase (check if connection string contains supabase.co or pooler.supabase.com)
const isSupabase = process.env.DB_URL && (
  process.env.DB_URL.includes('supabase.co') || 
  process.env.DB_URL.includes('pooler.supabase.com')
);

// Log connection info (without password) for debugging
if (isSupabase) {
  const maskedUrl = process.env.DB_URL.replace(/:[^:@]+@/, ':****@');
  logger.info(`🔗 Connecting to Supabase: ${maskedUrl}`);
  
  // Warn if using direct connection (IPv6-only)
  if (process.env.DB_URL.includes('db.') && process.env.DB_URL.includes('.supabase.co') && 
      !process.env.DB_URL.includes('pooler')) {
    logger.warn('⚠️  Using direct connection (IPv6-only). If connection fails, use connection pooler instead.');
    logger.warn('   Get pooler connection string from: Supabase Dashboard → Settings → Database → Connection pooling');
  }
}

// Supabase requires SSL connections, so enable SSL when using Supabase
// For local PostgreSQL, only enable SSL in production
const sslConfig = isSupabase 
  ? { rejectUnauthorized: false } // Supabase uses SSL certificates
  : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false);

const pool = new Pool({
  connectionString: process.env.DB_URL,
  ssl: sslConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased timeout for network issues
});

const connectDB = async () => {
  try {
    logger.info('🔄 Attempting database connection...');
    const client = await pool.connect();
    logger.info('✅ Database connected successfully');
    client.release();
  } catch (error) {
    logger.error('❌ Database connection failed:', {
      message: error.message,
      code: error.code,
      hostname: error.hostname || 'unknown',
      syscall: error.syscall || 'unknown'
    });
    
    // Provide helpful error messages
    if (error.code === 'ENOENT' || error.syscall === 'getaddrinfo') {
      logger.error('💡 Troubleshooting tips:');
      logger.error('   1. This is likely an IPv6 connection issue on Windows');
      logger.error('   2. Use Supavisor connection pooler (IPv4-compatible) instead');
      logger.error('   3. Get pooler connection string from: Supabase Dashboard → Settings → Database');
      logger.error('   4. Format: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres');
      logger.error('   5. Verify your Supabase project is active (not paused)');
    }
    
    throw error;
  }
};

// Test query function
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Query error:', { text, error: error.message });
    throw error;
  }
};

// Transaction helper
const transaction = async (callback) => {
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
};

module.exports = {
  pool,
  query,
  transaction,
  connectDB
};