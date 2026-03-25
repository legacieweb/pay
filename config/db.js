const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PnMN7aLs1pJb@ep-empty-pine-an2l7qgt-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require',
  {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      },
      connectTimeout: 60000
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 60000,
      idle: 10000
    }
  }
);

const connectDB = async () => {
  let retries = 5;
  while (retries > 0) {
    try {
      await sequelize.authenticate();
      console.log('PostgreSQL Connected (Neon DB)');
      
      // Sync models (use { force: true } to drop and recreate tables)
      try {
        await sequelize.sync({ alter: true });
        console.log('Database models synchronized');
      } catch (syncErr) {
        console.error('Initial sync failed, attempting to fix column cast issues:', syncErr.message);
        if (syncErr.message.includes('cannot be cast automatically to type integer')) {
          console.log('Detected userId cast issue in default_amounts. Attempting fix...');
          try {
            // Drop the table and recreate it since it's safer than complex ALTERS if data is not critical
            await sequelize.query('DROP TABLE IF EXISTS "default_amounts" CASCADE;');
            await sequelize.sync({ alter: true });
            console.log('Database models synchronized after fix');
          } catch (fixErr) {
            console.error('Failed to fix database sync:', fixErr.message);
            throw fixErr;
          }
        } else {
          throw syncErr;
        }
      }
      return;
    } catch (err) {
      console.error(`PostgreSQL connection error (${retries} retries left):`, err.message);
      retries--;
      if (retries > 0) {
        console.log('Retrying in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        console.error('Failed to connect to database after all retries');
        process.exit(1);
      }
    }
  }
};

module.exports = connectDB;
module.exports.sequelize = sequelize;
