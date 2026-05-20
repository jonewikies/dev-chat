export enum MessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  AI_SUMMARY = 'ai_summary',
}

export interface User {
  id: string;
  name: string;
  avatar: string;
  isOnline: boolean;
}

export interface Repository {
  url: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  goal: string;
  timeline: string;
  content: string;
  creator: string;
  owner: string;
  repositories: Repository[];
  status: 'active' | 'completed' | 'on-hold';
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: string;
  type: MessageType;
  metadata?: any;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastTimestamp?: string;
  unreadCount: number;
  isGroup: boolean;
  projectId?: string; // Linked project
  memberIds?: string[]; // User IDs
  projectIds?: string[]; // Project IDs
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  assigneeId?: string;
  status: 'todo' | 'in-progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  startDate: string;
  endDate: string;
  progress: number; // 0-100
}

export interface Bug {
  id: string;
  projectId: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'fixed' | 'closed';
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  content: string;
  type: import('./constants/document').DocumentType;
  updatedAt: string;
}
