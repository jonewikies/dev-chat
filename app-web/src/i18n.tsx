import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Language = 'en' | 'zh';

interface Translations {
  [key: string]: {
    [K in Language]: string;
  };
}

export const translations: Translations = {
  studio: { en: 'Studio', zh: '工作台' },
  chats: { en: 'Chats', zh: '聊天' },
  contacts: { en: 'Contacts', zh: '联系人' },
  projects: { en: 'Projects', zh: '项目' },
  all: { en: 'All', zh: '全部' },
  active: { en: 'Active', zh: '进行中' },
  completed: { en: 'Completed', zh: '已完成' },
  onHold: { en: 'On Hold', zh: '已暂停' },
  search: { en: 'Search', zh: '搜索' },
  searchProjects: { en: 'Search projects', zh: '搜索项目' },
  newGroupChat: { en: 'New Group Chat', zh: '新建群聊' },
  addContact: { en: 'Add Contact', zh: '添加联系人' },
  newProject: { en: 'New Project', zh: '新建项目' },
  projectWorkspaceSubtitle: { en: 'A focused workspace for long-range initiatives, milestones, and delivery.', zh: '聚焦长期项目、阶段里程碑与交付推进的项目工作台。' },
  activeWorkstreams: { en: 'active workstreams', zh: '个活跃项目' },
  projectIndex: { en: 'Project Index', zh: '项目列表' },
  curatedInitiatives: { en: 'Curated initiatives from your workspace', zh: '工作区中的项目与计划概览' },
  loadingProjects: { en: 'Loading projects...', zh: '正在加载项目...' },
  noMatchingProjects: { en: 'No matching projects yet.', zh: '暂无符合条件的项目。' },
  noProjectSelected: { en: 'Select a project to see details.', zh: '请选择一个项目查看详情。' },
  activeProject: { en: 'Active Project', zh: '当前项目' },
  noProjectDescription: { en: 'No description yet.', zh: '暂无项目简介。' },
  noProjectNarrative: { en: 'Define this project with a clear narrative.', zh: '请为项目补充一段清晰的背景说明。' },
  noProjectObjective: { en: 'No objective captured yet.', zh: '暂未填写项目目标。' },
  noProjectScope: { en: 'Add scope details to align the team.', zh: '补充项目范围说明，便于团队对齐。' },
  createdAtLabel: { en: 'Created', zh: '创建时间' },
  lastUpdate: { en: 'Last Update', zh: '最后更新' },
  start: { en: 'Start', zh: '开始' },
  end: { en: 'End', zh: '结束' },
  groupChat: { en: 'Group Chat', zh: '群聊' },
  online: { en: 'Online', zh: '在线' },
  offline: { en: 'Offline', zh: '离线' },
  linkedTo: { en: 'Linked to', zh: '关联至' },
  typeMessage: { en: 'Type a message', zh: '输入消息' },
  viewProfile: { en: 'View Profile', zh: '查看详情' },
  role: { en: 'Role', zh: '角色' },
  department: { en: 'Department', zh: '部门' },
  sendMessage: { en: 'Send Message', zh: '发送消息' },
  overview: { en: 'Overview', zh: '概览' },
  tasks: { en: 'Tasks', zh: '任务' },
  bugs: { en: 'Bugs', zh: '缺陷' },
  docs: { en: 'Docs', zh: '文档' },
  code: { en: 'Code', zh: '代码' },
  projectGoal: { en: 'Project Goal', zh: '项目目标' },
  projectContent: { en: 'Project Content', zh: '项目内容' },
  gitRepos: { en: 'Git Repositories', zh: 'Git 仓库' },
  details: { en: 'Details', zh: '详情' },
  timeline: { en: 'Timeline', zh: '时间线' },
  creator: { en: 'Creator', zh: '创建者' },
  owner: { en: 'Owner', zh: '负责人' },
  openProjectChat: { en: 'Open Project Chat', zh: '打开项目聊天' },
  selectToStart: { en: 'Select a chat, contact, or project to get started.', zh: '选择一个聊天、联系人或项目开始工作。' },
  aiInsight: { en: 'AI Insight', zh: 'AI 洞察' },
  activeSprints: { en: 'Active Sprints', zh: '活跃迭代' },
  newTask: { en: 'New Task', zh: '新建任务' },
  progress: { en: 'Progress', zh: '进度' },
  time: { en: 'Time', zh: '时间' },
  severity: { en: 'Severity', zh: '严重程度' },
  status: { en: 'Status', zh: '状态' },
  addToGroup: { en: 'Add to Group', zh: '添加到群组' },
  selectContactsOrProjects: { en: 'Select Contacts or Projects', zh: '选择联系人或项目' },
  membersAccessNote: { en: 'Members added will have access to the chat history and linked resources.', zh: '添加的成员将拥有访问聊天历史和关联资源的权限。' },
  initializeNewProject: { en: 'Initialize New Project', zh: '初始化新项目' },
  manager: { en: 'Manager', zh: '负责人' },
  projectMilestone: { en: 'Project Milestone', zh: '项目里程碑' },
  milestonePlaceholder: { en: 'Define project milestones...', zh: '请输入项目里程碑...' },
  defineCoreParameters: { en: 'Define the core parameters for your R&D initiative', zh: '定义您的研发计划核心参数' },
  coreIdentity: { en: 'Core Identity', zh: '核心标识' },
  projectName: { en: 'Project Name', zh: '项目名称' },
  responsibleOwner: { en: 'Responsible Owner', zh: '负责人' },
  strategicGoals: { en: 'Strategic Goals', zh: '战略目标' },
  primaryObjective: { en: 'Primary Objective', zh: '主要目标' },
  timelinePlan: { en: 'Timeline Plan', zh: '时间线计划' },
  shortDescription: { en: 'Short Description (Sidebar)', zh: '简短描述 (侧边栏)' },
  technicalScope: { en: 'Technical Scope', zh: '技术范围' },
  projectContentDetails: { en: 'Project Content & Details', zh: '项目内容与详情' },
  repositories: { en: 'Repositories', zh: '仓库' },
  addRepository: { en: 'Add Repository', zh: '添加仓库' },
  discardChanges: { en: 'Discard Changes', zh: '放弃更改' },
  createProject: { en: 'Create Project', zh: '创建项目' },
  projectNamePlaceholder: { en: 'e.g. Project Phoenix', zh: '例如：凤凰项目' },
  ownerPlaceholder: { en: 'Who is leading this?', zh: '谁在领导这个项目？' },
  goalPlaceholder: { en: 'What is the main mission?', zh: '主要使命是什么？' },
  timelinePlaceholder: { en: 'e.g. Q3 2024 - Q1 2025', zh: '例如：2024 Q3 - 2025 Q1' },
  descriptionPlaceholder: { en: 'A one-liner for the list view', zh: '列表视图的一句话简介' },
  contentPlaceholder: { en: 'Elaborate on the technical scope, requirements, and key deliverables...', zh: '详细说明技术范围、需求和关键交付物...' },
  repoNamePlaceholder: { en: 'Repository Name (e.g. API Gateway)', zh: '仓库名称 (例如：API 网关)' },
  repoUrlPlaceholder: { en: 'GitLab Repository URL', zh: 'GitLab 仓库 URL' },
  openIssues: { en: 'Open Issues', zh: '待处理问题' },
  reportBug: { en: 'Report Bug', zh: '报告缺陷' },
  priority: { en: 'priority', zh: '优先级' },
  reportedBy: { en: 'Reported by', zh: '报告人' },
  assign: { en: 'Assign', zh: '指派' },
  fix: { en: 'Fix', zh: '修复' },
  knowledgeBase: { en: 'Knowledge Base', zh: '知识库' },
  newDoc: { en: 'New Doc', zh: '新建文档' },
  updated: { en: 'Updated', zh: '更新于' },
  recentPullRequests: { en: 'Recent Pull Requests', zh: '最近的合并请求' },
  openStatus: { en: 'OPEN', zh: '开启' },
  reviewersApproved: { en: 'reviewers approved', zh: '位评审员已通过' },
  aiAnalyzed: { en: "AI: I've analyzed the discussion and updated the list for", zh: 'AI：我已经分析了讨论并更新了列表：' },
  autoGeneratedSummary: { en: 'Auto-generated summary based on recent messages.', zh: '基于最近消息自动生成的摘要。' },
  newTaskFromChat: { en: 'New task from chat', zh: '来自聊天的任务' },
  newReportedBug: { en: 'New reported bug', zh: '新报告的缺陷' },
  addMembers: { en: 'Add Members', zh: '添加成员' },
  cancel: { en: 'Cancel', zh: '取消' },
  confirm: { en: 'Confirm', zh: '确认' },
  seniorDeveloper: { en: 'Senior Developer', zh: '高级开发工程师' },
  rdCore: { en: 'R&D Core', zh: '研发核心组' },
  addMember: { en: 'Add Member', zh: '添加成员' },
  groupMembers: { en: 'Group Members', zh: '群成员' },
  high: { en: 'High', zh: '高' },
  medium: { en: 'Medium', zh: '中' },
  low: { en: 'Low', zh: '低' },
  critical: { en: 'Critical', zh: '紧急' },
  todo: { en: 'To Do', zh: '待办' },
  'in-progress': { en: 'In Progress', zh: '进行中' },
  done: { en: 'Done', zh: '已完成' },
  // Auth Pages
  login: { en: 'Sign In', zh: '登录' },
  register: { en: 'Sign Up', zh: '注册' },
  username: { en: 'Username', zh: '用户名' },
  password: { en: 'Password', zh: '密码' },
  email: { en: 'Email', zh: '邮箱' },
  displayName: { en: 'Display Name', zh: '显示名称' },
  confirmPassword: { en: 'Confirm Password', zh: '确认密码' },
  enterUsername: { en: 'Enter your username', zh: '输入用户名' },
  enterPassword: { en: 'Enter your password', zh: '输入密码' },
  enterEmail: { en: 'Enter your email', zh: '输入邮箱' },
  enterDisplayName: { en: 'Enter your display name', zh: '输入显示名称' },
  reEnterPassword: { en: 'Re-enter password', zh: '再次输入密码' },
  loginSubtitle: { en: 'Chat-driven R&D Management', zh: '聊天驱动的研发管理' },
  registerSubtitle: { en: 'Join the R&D Revolution', zh: '加入研发革命' },
  createAccount: { en: 'Create Account', zh: '创建账号' },
  noAccount: { en: "Don't have an account?", zh: '还没有账号？' },
  alreadyHaveAccount: { en: 'Already have an account?', zh: '已有账号？' },
  signingIn: { en: 'Signing in...', zh: '登录中...' },
  creatingAccount: { en: 'Creating account...', zh: '创建账号中...' },
  demoHint: { en: 'Demo: Try registering a new account or use test credentials', zh: '演示：尝试注册新账号或使用测试凭据' },
  logout: { en: 'Logout', zh: '退出登录' },
  confirmLogout: { en: 'Are you sure you want to logout?', zh: '确定要退出登录吗？' },
  
  // Add Contact Modal
  searchUserPlaceholder: { en: 'Search by username or email...', zh: '搜索用户名或邮箱...' },
  searching: { en: 'Searching...', zh: '搜索中...' },
  add: { en: 'Add', zh: '添加' },
  adding: { en: 'Adding...', zh: '添加中...' },
  added: { en: 'Added', zh: '已添加' },
  noUsersFound: { en: 'No users found', zh: '未找到用户' },
  
  // Contact Detail Page
  contactNotFound: { en: 'Contact not found', zh: '联系人不存在' },
  backToHome: { en: 'Back to Home', zh: '返回首页' },
  contactDetails: { en: 'Contact Details', zh: '联系人详情' },
  joinedAt: { en: 'Joined At', zh: '加入时间' },
  lastSeen: { en: 'Last Seen', zh: '最后在线' },
  loading: { en: 'Loading...', zh: '加载中...' },
  
  // Chat Page
  chat: { en: 'Chat', zh: '对话' },
  chatNotFound: { en: 'Chat not found', zh: '对话不存在' },
  noMessages: { en: 'No messages yet', zh: '暂无消息' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('zh');

  const t = (key: string) => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
