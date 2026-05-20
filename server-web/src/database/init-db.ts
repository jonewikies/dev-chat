#!/usr/bin/env node
import { initializeSchema, startAutoSave } from './connection';
import logger from '../utils/logger.util';

const runInitDb = async () => {
  try {
    logger.info('Starting database initialization...');
    await initializeSchema();
    startAutoSave();
    logger.info('Database initialization completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
};

runInitDb();