import { Database } from 'sql.js';
import { execQuery, execStatement, getDatabaseSync, saveDatabase } from '../database/connection';
import { AIAnalysis, AIAnalysisWithMessages } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class AIAnalysisRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  private rowToAnalysis(row: any[]): AIAnalysis | null {
    if (!row || row.length === 0) return null;

    return {
      id: row[0],
      chat_id: row[1],
      analysis_type: row[2],
      result: row[3],
      status: row[4],
      created_at: normalizeDateTimeOutput(row[5])!,
    };
  }

  private attachMessageIds(analysis: AIAnalysis | null): AIAnalysisWithMessages | null {
    if (!analysis) {
      return null;
    }

    return {
      ...analysis,
      message_ids: this.getMessageIds(analysis.id),
    };
  }

  findById(id: number): AIAnalysisWithMessages | null {
    const results = execQuery(
      this.db,
      `SELECT id, chat_id, analysis_type, result, status, created_at
       FROM ai_analyses
       WHERE id = ?`,
      [id]
    );

    if (results.length === 0) return null;
    return this.attachMessageIds(this.rowToAnalysis(results[0]));
  }

  findByChatId(
    chatId: number,
    filters?: {
      analysisType?: AIAnalysis['analysis_type'];
      status?: AIAnalysis['status'];
      limit?: number;
    }
  ): AIAnalysisWithMessages[] {
    const clauses = ['chat_id = ?'];
    const params: any[] = [chatId];

    if (filters?.analysisType) {
      clauses.push('analysis_type = ?');
      params.push(filters.analysisType);
    }

    if (filters?.status) {
      clauses.push('status = ?');
      params.push(filters.status);
    }

    const limit = Math.max(1, filters?.limit || 20);
    params.push(limit);

    const results = execQuery(
      this.db,
      `SELECT id, chat_id, analysis_type, result, status, created_at
       FROM ai_analyses
       WHERE ${clauses.join(' AND ')}
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
      params
    );

    return results
      .map((row) => this.attachMessageIds(this.rowToAnalysis(row)))
      .filter((analysis) => analysis !== null) as AIAnalysisWithMessages[];
  }

  getMessageIds(analysisId: number): number[] {
    const results = execQuery(
      this.db,
      `SELECT message_id
       FROM ai_analysis_messages
       WHERE analysis_id = ?
       ORDER BY id ASC`,
      [analysisId]
    );

    return results.map((row) => row[0] as number);
  }

  create(data: {
    chatId: number;
    analysisType: AIAnalysis['analysis_type'];
    result: string;
    status?: AIAnalysis['status'];
    messageIds?: number[];
  }): AIAnalysisWithMessages {
    execStatement(
      this.db,
      `INSERT INTO ai_analyses (chat_id, analysis_type, result, status, created_at)
       VALUES (?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
      [data.chatId, data.analysisType, data.result, data.status || 'pending']
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const analysisId = result[0].values[0][0] as number;

    this.replaceMessageIds(analysisId, data.messageIds || []);
    saveDatabase();

    return this.findById(analysisId)!;
  }

  update(
    id: number,
    data: {
      result?: string;
      status?: AIAnalysis['status'];
      messageIds?: number[];
    }
  ): AIAnalysisWithMessages {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.result !== undefined) {
      fields.push('result = ?');
      values.push(data.result);
    }

    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }

    if (fields.length > 0) {
      values.push(id);
      execStatement(this.db, `UPDATE ai_analyses SET ${fields.join(', ')} WHERE id = ?`, values);
    }

    if (data.messageIds !== undefined) {
      this.replaceMessageIds(id, data.messageIds);
    }

    saveDatabase();
    return this.findById(id)!;
  }

  private replaceMessageIds(analysisId: number, messageIds: number[]): void {
    execStatement(this.db, 'DELETE FROM ai_analysis_messages WHERE analysis_id = ?', [analysisId]);

    messageIds.forEach((messageId) => {
      execStatement(
        this.db,
        `INSERT INTO ai_analysis_messages (analysis_id, message_id, created_at)
         VALUES (?, ?, ${SQLITE_LOCAL_TIMESTAMP})`,
        [analysisId, messageId]
      );
    });
  }
}