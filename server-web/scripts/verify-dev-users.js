#!/usr/bin/env node

require('./lib/register-ts');

const { initializeSchema, closeDatabase } = require('../src/database/connection');
const { UserRepository } = require('../src/repositories/user.repository');
const { FriendshipRepository } = require('../src/repositories/friendship.repository');
const { loadSeedConfig } = require('./lib/dev-user-seed');

const run = async () => {
  const { usernames, password } = loadSeedConfig();

  await initializeSchema();

  const userRepo = new UserRepository();
  const friendshipRepo = new FriendshipRepository();

  const users = usernames.map((username) => ({ username, user: userRepo.findByUsername(username) }));
  const missingUsers = users.filter((item) => !item.user).map((item) => item.username);
  const existingUsers = users.filter((item) => item.user);
  const seedUserIds = new Set(existingUsers.map((item) => item.user.id));
  const friendshipCounts = existingUsers.map((item) => ({
    username: item.username,
    seedFriendCount: friendshipRepo.findFriends(item.user.id).filter((friendship) => seedUserIds.has(friendship.friend_id)).length,
    extraFriendCount: friendshipRepo.findFriends(item.user.id).filter((friendship) => !seedUserIds.has(friendship.friend_id)).length,
  }));

  const missingFriendships = [];
  for (let i = 0; i < existingUsers.length; i += 1) {
    for (let j = 0; j < existingUsers.length; j += 1) {
      if (i === j) {
        continue;
      }

      const source = existingUsers[i].user;
      const target = existingUsers[j].user;
      if (!friendshipRepo.findByUserAndFriend(source.id, target.id)) {
        missingFriendships.push(`${existingUsers[i].username} -> ${existingUsers[j].username}`);
      }
    }
  }

  console.log(`[verify-dev-users] expected users: ${usernames.length}`);
  console.log(`[verify-dev-users] existing users: ${existingUsers.length}`);
  console.log(`[verify-dev-users] missing users: ${missingUsers.length}`);
  console.log(`[verify-dev-users] expected directed friendships: ${existingUsers.length * Math.max(existingUsers.length - 1, 0)}`);
  console.log(`[verify-dev-users] missing directed friendships: ${missingFriendships.length}`);
  console.log(`[verify-dev-users] configured initial password: ${password}`);

  if (missingUsers.length > 0) {
    console.log(`[verify-dev-users] missing user list: ${missingUsers.join(', ')}`);
  }

  if (friendshipCounts.length > 0) {
    console.log('[verify-dev-users] friendship count by user:');
    friendshipCounts
      .sort((left, right) => left.username.localeCompare(right.username))
      .forEach((item) => {
        console.log(`[verify-dev-users]   ${item.username}: seed-set=${item.seedFriendCount}, extra=${item.extraFriendCount}`);
      });
  }

  if (missingFriendships.length > 0) {
    console.log(`[verify-dev-users] sample missing friendships: ${missingFriendships.slice(0, 20).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  if (missingUsers.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log('[verify-dev-users] verification passed');
};

run()
  .catch((error) => {
    console.error('[verify-dev-users] failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    closeDatabase();
  });