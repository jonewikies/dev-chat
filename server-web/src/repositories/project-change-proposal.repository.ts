import { Database } from 'sql.js';
import { execQuery, execStatement, getDatabaseSync, saveDatabase } from '../database/connection';
import { ProjectChangeProposal, ProjectChangeProposalWithReviewer } from '../types/db.types';
import { normalizeDateTimeOutput, SQLITE_LOCAL_TIMESTAMP } from '../utils/date-time.util';

export class ProjectChangeProposalRepository {
  private get db(): Database {
    return getDatabaseSync();
  }

  private rowToProposal(row: any[]): ProjectChangeProposal | null {
    if (!row || row.length === 0) return null;

    return {
      id: row[0],
      project_id: row[1],
      chat_id: row[2],
      ai_analysis_id: row[3],
      target_type: row[4],
      action: row[5],
      target_id: row[6] || undefined,
      title: row[7],
      summary: row[8] || undefined,
      payload: row[9],
      reason: row[10] || undefined,
      original_title: row[11] || undefined,
      original_summary: row[12] || undefined,
      original_payload: row[13] || undefined,
      original_reason: row[14] || undefined,
      source_message_ids: row[15] || undefined,
      confidence: row[16] ?? undefined,
      status: row[17],
      reviewer_id: row[18] || undefined,
      reviewer_comment: row[19] || undefined,
      reviewed_at: normalizeDateTimeOutput(row[20]) || undefined,
      applied_at: normalizeDateTimeOutput(row[21]) || undefined,
      created_at: normalizeDateTimeOutput(row[22])!,
      updated_at: normalizeDateTimeOutput(row[23])!,
    };
  }

  private rowToProposalWithReviewer(row: any[]): ProjectChangeProposalWithReviewer | null {
    const proposal = this.rowToProposal(row);
    if (!proposal) return null;

    const proposalWithReviewer: ProjectChangeProposalWithReviewer = { ...proposal };

    if (row[24] !== null && row[24] !== undefined) {
      proposalWithReviewer.reviewer = {
        id: row[24],
        username: row[25],
        avatar: row[26] || undefined,
      };
    }

    return proposalWithReviewer;
  }

  findById(id: number): ProjectChangeProposal | null {
    const results = execQuery(
      this.db,
      `SELECT
        id,
        project_id,
        chat_id,
        ai_analysis_id,
        target_type,
        action,
        target_id,
        title,
        summary,
        payload,
        reason,
        original_title,
        original_summary,
        original_payload,
        original_reason,
        source_message_ids,
        confidence,
        status,
        reviewer_id,
        reviewer_comment,
        reviewed_at,
        applied_at,
        created_at,
        updated_at
      FROM project_change_proposals
      WHERE id = ?`,
      [id]
    );

    if (results.length === 0) return null;
    return this.rowToProposal(results[0]);
  }

  findWithReviewerById(id: number): ProjectChangeProposalWithReviewer | null {
    const results = execQuery(
      this.db,
      `SELECT
        p.id,
        p.project_id,
        p.chat_id,
        p.ai_analysis_id,
        p.target_type,
        p.action,
        p.target_id,
        p.title,
        p.summary,
        p.payload,
        p.reason,
        p.original_title,
        p.original_summary,
        p.original_payload,
        p.original_reason,
        p.source_message_ids,
        p.confidence,
        p.status,
        p.reviewer_id,
        p.reviewer_comment,
        p.reviewed_at,
        p.applied_at,
        p.created_at,
        p.updated_at,
        u.id as reviewer_user_id,
        u.username as reviewer_username,
        u.avatar_url as reviewer_avatar
      FROM project_change_proposals p
      LEFT JOIN users u ON p.reviewer_id = u.id
      WHERE p.id = ?`,
      [id]
    );

    if (results.length === 0) return null;
    return this.rowToProposalWithReviewer(results[0]);
  }

  findByProject(
    projectId: number,
    filters?: {
      status?: ProjectChangeProposal['status'];
      targetType?: ProjectChangeProposal['target_type'];
      chatId?: number;
      limit?: number;
      offset?: number;
    }
  ): ProjectChangeProposalWithReviewer[] {
    const clauses = ['p.project_id = ?'];
    const params: any[] = [projectId];

    if (filters?.status) {
      clauses.push('p.status = ?');
      params.push(filters.status);
    }

    if (filters?.targetType) {
      clauses.push('p.target_type = ?');
      params.push(filters.targetType);
    }

    if (filters?.chatId) {
      clauses.push('p.chat_id = ?');
      params.push(filters.chatId);
    }

    const limit = Math.max(1, filters?.limit || 50);
    const offset = Math.max(0, filters?.offset || 0);
    params.push(limit, offset);

    const results = execQuery(
      this.db,
      `SELECT
        p.id,
        p.project_id,
        p.chat_id,
        p.ai_analysis_id,
        p.target_type,
        p.action,
        p.target_id,
        p.title,
        p.summary,
        p.payload,
        p.reason,
        p.original_title,
        p.original_summary,
        p.original_payload,
        p.original_reason,
        p.source_message_ids,
        p.confidence,
        p.status,
        p.reviewer_id,
        p.reviewer_comment,
        p.reviewed_at,
        p.applied_at,
        p.created_at,
        p.updated_at,
        u.id as reviewer_user_id,
        u.username as reviewer_username,
        u.avatar_url as reviewer_avatar
      FROM project_change_proposals p
      LEFT JOIN users u ON p.reviewer_id = u.id
      WHERE ${clauses.join(' AND ')}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ? OFFSET ?`,
      params
    );

    return results
      .map((row) => this.rowToProposalWithReviewer(row))
      .filter((proposal) => proposal !== null) as ProjectChangeProposalWithReviewer[];
  }

  create(data: {
    projectId: number;
    chatId: number;
    aiAnalysisId: number;
    targetType: ProjectChangeProposal['target_type'];
    action: ProjectChangeProposal['action'];
    targetId?: number;
    title: string;
    summary?: string;
    payload: string;
    reason?: string;
    originalTitle?: string;
    originalSummary?: string;
    originalPayload?: string;
    originalReason?: string;
    sourceMessageIds?: string;
    confidence?: number;
    status?: ProjectChangeProposal['status'];
  }): ProjectChangeProposal {
    execStatement(
      this.db,
      `INSERT INTO project_change_proposals (
        project_id,
        chat_id,
        ai_analysis_id,
        target_type,
        action,
        target_id,
        title,
        summary,
        payload,
        reason,
        original_title,
        original_summary,
        original_payload,
        original_reason,
        source_message_ids,
        confidence,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${SQLITE_LOCAL_TIMESTAMP}, ${SQLITE_LOCAL_TIMESTAMP})`,
      [
        data.projectId,
        data.chatId,
        data.aiAnalysisId,
        data.targetType,
        data.action,
        data.targetId || null,
        data.title,
        data.summary || null,
        data.payload,
        data.reason || null,
        data.originalTitle || data.title,
        data.originalSummary || data.summary || null,
        data.originalPayload || data.payload,
        data.originalReason || data.reason || null,
        data.sourceMessageIds || null,
        data.confidence ?? null,
        data.status || 'pending',
      ]
    );

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    const proposalId = result[0].values[0][0] as number;

    saveDatabase();
    return this.findById(proposalId)!;
  }

  update(
    id: number,
    data: {
      targetId?: number;
      title?: string;
      summary?: string;
      payload?: string;
      originalTitle?: string;
      originalSummary?: string;
      originalPayload?: string;
      originalReason?: string;
      reason?: string;
      sourceMessageIds?: string;
      confidence?: number;
      status?: ProjectChangeProposal['status'];
      reviewerId?: number;
      reviewerComment?: string;
      reviewedAt?: string | null;
      appliedAt?: string | null;
    }
  ): ProjectChangeProposal {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title);
    }
    if (data.targetId !== undefined) {
      fields.push('target_id = ?');
      values.push(data.targetId);
    }
    if (data.summary !== undefined) {
      fields.push('summary = ?');
      values.push(data.summary);
    }
    if (data.payload !== undefined) {
      fields.push('payload = ?');
      values.push(data.payload);
    }
    if (data.originalTitle !== undefined) {
      fields.push('original_title = ?');
      values.push(data.originalTitle);
    }
    if (data.originalSummary !== undefined) {
      fields.push('original_summary = ?');
      values.push(data.originalSummary);
    }
    if (data.originalPayload !== undefined) {
      fields.push('original_payload = ?');
      values.push(data.originalPayload);
    }
    if (data.originalReason !== undefined) {
      fields.push('original_reason = ?');
      values.push(data.originalReason);
    }
    if (data.reason !== undefined) {
      fields.push('reason = ?');
      values.push(data.reason);
    }
    if (data.sourceMessageIds !== undefined) {
      fields.push('source_message_ids = ?');
      values.push(data.sourceMessageIds);
    }
    if (data.confidence !== undefined) {
      fields.push('confidence = ?');
      values.push(data.confidence);
    }
    if (data.status !== undefined) {
      fields.push('status = ?');
      values.push(data.status);
    }
    if (data.reviewerId !== undefined) {
      fields.push('reviewer_id = ?');
      values.push(data.reviewerId);
    }
    if (data.reviewerComment !== undefined) {
      fields.push('reviewer_comment = ?');
      values.push(data.reviewerComment);
    }
    if (data.reviewedAt !== undefined) {
      fields.push('reviewed_at = ?');
      values.push(data.reviewedAt);
    }
    if (data.appliedAt !== undefined) {
      fields.push('applied_at = ?');
      values.push(data.appliedAt);
    }

    if (fields.length === 0) {
      return this.findById(id)!;
    }

    fields.push(`updated_at = ${SQLITE_LOCAL_TIMESTAMP}`);
    values.push(id);

    execStatement(
      this.db,
      `UPDATE project_change_proposals SET ${fields.join(', ')} WHERE id = ?`,
      values
    );

    saveDatabase();
    return this.findById(id)!;
  }
}