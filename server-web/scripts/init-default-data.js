#!/usr/bin/env node

require('./lib/register-ts');

const { initializeDefaultData } = require('../src/database/init-default-data');
const { initializeSchema, closeDatabase } = require('../src/database/connection');

(async () => {
	await initializeSchema();
	await initializeDefaultData();
})()
	.catch((error) => {
		console.error('[init-default-data] failed:', error);
		process.exitCode = 1;
	})
	.finally(() => {
		closeDatabase();
	});