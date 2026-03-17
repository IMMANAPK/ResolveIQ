import { databaseConfig } from './database.config';

describe('databaseConfig', () => {
  it('should return TypeORM config object with expected keys', () => {
    process.env.DB_HOST = 'localhost';
    process.env.DB_PORT = '5432';
    process.env.DB_USERNAME = 'postgres';
    process.env.DB_PASSWORD = 'postgres';
    process.env.DB_DATABASE = 'resolveiq';
    const config = databaseConfig();
    expect(config).toHaveProperty('type', 'postgres');
    expect(config).toHaveProperty('host', 'localhost');
    expect(config).toHaveProperty('synchronize');
  });
});
