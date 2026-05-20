import request from 'supertest';
import { Application } from 'express';
import { setupTestApp, registerAndLogin, teardownTest } from './setup';
import { execQuery, getDatabaseSync } from '../src/database/connection';

describe('Message API', () => {
  let app: Application;
  let ownerToken: string;
  let memberToken: string;
  let memberId: number;
  let thirdMemberId: number;
  let outsiderId: number;
  let groupChatId: number;

  beforeAll(async () => {
    app = await setupTestApp();

    const ownerAuth = await registerAndLogin(app);
    ownerToken = ownerAuth.token;

    const memberAuth = await registerAndLogin(app);
    memberToken = memberAuth.token;
    memberId = memberAuth.userId;

    const thirdMemberAuth = await registerAndLogin(app);
    thirdMemberId = thirdMemberAuth.userId;

    const outsiderAuth = await registerAndLogin(app);
    outsiderId = outsiderAuth.userId;

    const createChatResponse = await request(app)
      .post('/api/chats/group')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Mention Test Group',
        memberIds: [memberId, thirdMemberId],
      })
      .expect(201);

    groupChatId = createChatResponse.body.data.id;
  });

  afterAll(async () => {
    await teardownTest();
  });

  it('persists and returns valid @mention metadata for group messages', async () => {
    const sendResponse = await request(app)
      .post(`/api/chats/${groupChatId}/messages`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        content: '请 @test 先预留，真正提及的是同组成员。',
        type: 'text',
        metadata: {
          mentions: [
            { userId: memberId },
            { userId: outsiderId },
            { userId: memberId },
          ],
        },
      })
      .expect(201);

    expect(sendResponse.body.success).toBe(true);
    expect(sendResponse.body.data.message.metadata.mentions).toHaveLength(1);
    expect(sendResponse.body.data.message.metadata.mentions[0].userId).toBe(memberId);

    const listResponse = await request(app)
      .get(`/api/chats/${groupChatId}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const savedMessage = listResponse.body.data.messages.find((message: any) => message.id === sendResponse.body.data.message.id);
    expect(savedMessage).toBeDefined();
    expect(savedMessage.metadata.mentions).toHaveLength(1);
    expect(savedMessage.metadata.mentions[0].userId).toBe(memberId);
    expect(savedMessage.metadata.mentions[0].username).toBeDefined();
  });

  it('stores encrypted message content while returning decrypted content through the API', async () => {
    const plaintext = '这是一条需要加密存储的聊天消息';

    const sendResponse = await request(app)
      .post(`/api/chats/${groupChatId}/messages`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        content: plaintext,
        type: 'text',
      })
      .expect(201);

    expect(sendResponse.body.data.message.content).toBe(plaintext);

    const database = getDatabaseSync();
    const storedRows = execQuery(
      database,
      'SELECT content, content_iv, content_tag, content_key_version FROM messages WHERE id = ?',
      [sendResponse.body.data.message.id]
    );

    expect(storedRows).toHaveLength(1);
    expect(storedRows[0][0]).not.toBe(plaintext);
    expect(storedRows[0][1]).toBeTruthy();
    expect(storedRows[0][2]).toBeTruthy();
    expect(storedRows[0][3]).toBe(1);

    const listResponse = await request(app)
      .get(`/api/chats/${groupChatId}/messages`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const savedMessage = listResponse.body.data.messages.find((message: any) => message.id === sendResponse.body.data.message.id);
    expect(savedMessage).toBeDefined();
    expect(savedMessage.content).toBe(plaintext);
  });
});