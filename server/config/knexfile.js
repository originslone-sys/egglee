require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const path = require('path');

module.exports = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: path.resolve(__dirname, '../../data/galinha_farm.sqlite3'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: path.resolve(__dirname, '../migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, '../seeds'),
    },
    pool: {
      afterCreate(conn, cb) {
        conn.pragma('journal_mode = WAL');
        conn.pragma('foreign_keys = ON');
        cb();
      },
    },
  },

  production: {
    client: 'mysql2',
    connection: process.env.CLOUD_SQL_CONNECTION_NAME
      ? {
          // Cloud SQL via Unix socket
          socketPath: `/cloudsql/${process.env.CLOUD_SQL_CONNECTION_NAME}`,
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        }
      : {
          // Standard TCP connection
          host: process.env.DB_HOST,
          port: parseInt(process.env.DB_PORT || '3306', 10),
          user: process.env.DB_USER,
          password: process.env.DB_PASSWORD,
          database: process.env.DB_NAME,
        },
    migrations: {
      directory: path.resolve(__dirname, '../migrations'),
    },
    seeds: {
      directory: path.resolve(__dirname, '../seeds'),
    },
    pool: { min: 2, max: 20 },
  },
};
