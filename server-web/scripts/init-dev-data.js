#!/usr/bin/env node

const { spawnSync } = require('child_process');
const path = require('path');
const { ensureNoRunningDevServer } = require('./lib/runtime-guard');

const scriptDir = __dirname;

ensureNoRunningDevServer();

const runStep = (scriptName, label) => {
  console.log(`[init-dev-data] ${label}`);
  const result = spawnSync(process.execPath, [path.join(scriptDir, scriptName)], {
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

runStep('init-db.js', '初始化数据库结构');
runStep('init-default-data.js', '初始化默认管理员');
runStep('seed-dev-users.js', '创建开发测试用户和双向好友关系');
runStep('verify-dev-users.js', '校验开发测试用户和好友关系');

console.log('[init-dev-data] completed');