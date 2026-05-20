const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '../..');

const findConflictingServerProcesses = () => {
  try {
    const output = execSync("ps -Ao pid,command | grep -E 'src/server\\.ts|dist/server\\.js|nodemon' | grep -v grep", {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => line.includes(projectRoot))
      .filter((line) => !line.includes(` ${process.pid} `))
      .filter((line) => !line.includes('scripts/init-dev-data.js'))
      .filter((line) => !line.includes('scripts/seed-dev-users.js'))
      .filter((line) => !line.includes('scripts/verify-dev-users.js'));
  } catch {
    return [];
  }
};

const ensureNoRunningDevServer = () => {
  const processes = findConflictingServerProcesses();
  if (processes.length === 0) {
    return;
  }

  throw new Error(
    `检测到仍在运行的 DevChat 后端进程，会通过自动保存覆盖 SQLite 文件。请先停止这些进程后再执行初始化：\n${processes.join('\n')}`
  );
};

module.exports = {
  ensureNoRunningDevServer,
  findConflictingServerProcesses,
};