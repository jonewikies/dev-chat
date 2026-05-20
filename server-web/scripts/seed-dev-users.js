#!/usr/bin/env node

require('./lib/register-ts');

const { initializeSchema, closeDatabase } = require('../src/database/connection');
const { initializeDefaultData } = require('../src/database/init-default-data');
const { UserRepository } = require('../src/repositories/user.repository');
const { FriendshipRepository } = require('../src/repositories/friendship.repository');
const { hashPassword } = require('../src/utils/password.util');
const { loadSeedConfig } = require('./lib/dev-user-seed');
const { ensureNoRunningDevServer } = require('./lib/runtime-guard');

const ensureMutualFriendship = (friendshipRepo, userId, friendId) => {
  if (!friendshipRepo.findByUserAndFriend(userId, friendId)) {
    friendshipRepo.create(userId, friendId);
    return 1;
  }

  return 0;
};

const run = async () => {
  ensureNoRunningDevServer();

  const { usernames, password } = loadSeedConfig();

  await initializeSchema();
  await initializeDefaultData();

  const userRepo = new UserRepository();
  const friendshipRepo = new FriendshipRepository();

  const createdUsers = [];
  const existingUsers = [];
  const seededUsers = [];
  const passwordHash = await hashPassword(password);

  for (const username of usernames) {
    let user = userRepo.findByUsername(username);
    if (!user) {
      user = userRepo.create({
        username,
        passwordHash,
        displayName: username,
        email: `${username}@devchat.local`,
      });
      createdUsers.push(username);
    } else {
      existingUsers.push(username);
    }

    seededUsers.push(user);
  }

  let friendshipInsertions = 0;
  for (let i = 0; i < seededUsers.length; i += 1) {
    for (let j = i + 1; j < seededUsers.length; j += 1) {
      friendshipInsertions += ensureMutualFriendship(friendshipRepo, seededUsers[i].id, seededUsers[j].id);
      friendshipInsertions += ensureMutualFriendship(friendshipRepo, seededUsers[j].id, seededUsers[i].id);
    }
  }

  console.log(`[seed-dev-users] users total: ${seededUsers.length}`);
  console.log(`[seed-dev-users] users created: ${createdUsers.length}`);
  console.log(`[seed-dev-users] users existing: ${existingUsers.length}`);
  console.log(`[seed-dev-users] friendships inserted: ${friendshipInsertions}`);
  console.log(`[seed-dev-users] initial password: ${password}`);
};

run()
  .catch((error) => {
    console.error('[seed-dev-users] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase();
  });