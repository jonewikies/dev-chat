const fs = require('fs');
const path = require('path');

const seedFilePath = path.resolve(__dirname, '../../../deploy/人员名单.md');

const parseSeedConfig = (content) => {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const usernames = [];
  let password = 'init123';
  let inUsersSection = false;

  for (const line of lines) {
    if (line.startsWith('初始用户')) {
      inUsersSection = true;
      continue;
    }

    if (line.startsWith('初始密码')) {
      inUsersSection = false;
      const matchedPassword = line.replace('初始密码', '').trim();
      if (matchedPassword) {
        password = matchedPassword;
      }
      continue;
    }

    if (inUsersSection) {
      usernames.push(line);
    }
  }

  return {
    usernames: [...new Set(usernames)],
    password,
  };
};

const loadSeedConfig = () => {
  if (!fs.existsSync(seedFilePath)) {
    throw new Error(`未找到种子配置文件: ${seedFilePath}`);
  }

  const seedContent = fs.readFileSync(seedFilePath, 'utf8');
  const config = parseSeedConfig(seedContent);

  if (config.usernames.length === 0) {
    throw new Error('人员名单为空，无法处理开发用户');
  }

  return config;
};

module.exports = {
  seedFilePath,
  parseSeedConfig,
  loadSeedConfig,
};