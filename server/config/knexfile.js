require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

module.exports = {
  development: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'galinha_farm',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'galinha_farm',
    },
    migrations: {
      directory: require('path').resolve(__dirname, '../migrations'),
    },
    seeds: {
      directory: require('path').resolve(__dirname, '../seeds'),
    },
    pool: { min: 2, max: 10 },
  },

  production: {
    client: 'mysql2',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    },
    migrations: {
      directory: require('path').resolve(__dirname, '../migrations'),
    },
    seeds: {
      directory: require('path').resolve(__dirname, '../seeds'),
    },
    pool: { min: 2, max: 20 },
  },
};
