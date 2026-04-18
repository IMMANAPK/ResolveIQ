export const databaseConfig = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    type: 'postgres' as const,
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'resolveiq',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: !isProduction, // Never sync in production
    logging: process.env.DB_LOGGING === 'true' || process.env.NODE_ENV === 'development',

    // Connection pool settings
    extra: {
      // Maximum number of clients in the pool
      max: parseInt(process.env.DB_POOL_SIZE ?? '20', 10),
      // Minimum number of clients in the pool
      min: parseInt(process.env.DB_POOL_MIN ?? '5', 10),
      // Maximum time (ms) to wait for a connection
      connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT ?? '10000', 10),
      // Maximum time (ms) a client can be idle before being closed
      idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT ?? '30000', 10),
    },

    // SSL configuration for production
    ssl: isProduction && process.env.DB_SSL !== 'false'
      ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
      : false,

    // Retry settings
    retryAttempts: isProduction ? 10 : 3,
    retryDelay: 3000,
  };
};
