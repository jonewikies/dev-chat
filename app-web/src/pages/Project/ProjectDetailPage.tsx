import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { observer } from 'mobx-react-lite';
import { useChatStore, useProjectStore } from '../../hooks';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateTime } from '../../utils/date-time';
import { projectApi, userApi, taskApi, bugApi, ApiProjectMember, ApiTask } from '../../api';
import type { ApiBug } from '../../api/bug';
import { getAvatarUrl } from '../../constants/avatar';
import AddMemberModal from '../../components/Project/AddMemberModal';
import CreateTaskModal from '../../components/Task/CreateTaskModal';
import EditTaskModal from '../../components/Task/EditTaskModal';
import CreateBugModal from '../../components/Bug/CreateBugModal';
import EditBugModal from '../../components/Bug/EditBugModal';
import DocumentManagement from '../../components/Project/DocumentManagement';
import AIManagement from '../../components/Project/AIManagement';
import PrototypeManagement from '../../components/Project/PrototypeManagement';
import RepositoryManagement from '../../components/Project/RepositoryManagement';
import IconActionButton from '../../components/IconActionButton';
import { Plus, Pencil, Trash2, Bug, UserPlus } from 'lucide-react';

type TabType = 'overview' | 'tasks' | 'bugs' | 'documents' | 'ai' | 'prototypes' | 'repositories';
type BugViewTab = 'pending' | 'resolved' | 'mine';
type TaskViewTab = 'in-progress' | 'done' | 'mine';

interface MemberWithUser extends ApiProjectMember {
  user?: {
    id: number;
    username: string;
    displayName?: string;
    avatar?: string;
  };
}

interface EditState {
  description: boolean;
  goal: boolean;
  content: boolean;
  milestone: boolean;
  timeline: boolean;
  status: boolean;
}

export default observer(function ProjectDetailPage() {
  const { projectId, taskId, taskView, bugId, bugView } = useParams<{ projectId: string; taskId?: string; taskView?: string; bugId?: string; bugView?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const projectStore = useProjectStore();
  const chatStore = useChatStore();
  const { user: currentUser } = useAuth();
  const [members, setMembers] = useState<MemberWithUser[]>([]);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isEditTaskModalOpen, setIsEditTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<ApiTask | null>(null);
  const [focusedTask, setFocusedTask] = useState<ApiTask | null>(null);
  const [projectTasks, setProjectTasks] = useState<ApiTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskSearchInput, setTaskSearchInput] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskPage, setTaskPage] = useState(1);
  const [taskPageSize] = useState(10);
  const [taskTotal, setTaskTotal] = useState(0);
  const [taskStatusNote, setTaskStatusNote] = useState('');
  const [taskProgressDraft, setTaskProgressDraft] = useState(0);
  const [isCreateBugModalOpen, setIsCreateBugModalOpen] = useState(false);
  const [isEditBugModalOpen, setIsEditBugModalOpen] = useState(false);
  const [editingBug, setEditingBug] = useState<ApiBug | null>(null);
  const [bugs, setBugs] = useState<ApiBug[]>([]);
  const [bugsLoading, setBugsLoading] = useState(false);
  const [focusedBug, setFocusedBug] = useState<ApiBug | null>(null);
  const [bugSearchInput, setBugSearchInput] = useState('');
  const [bugSearch, setBugSearch] = useState('');
  const [bugPage, setBugPage] = useState(1);
  const [bugPageSize] = useState(10);
  const [bugTotal, setBugTotal] = useState(0);
  const [bugStatusNote, setBugStatusNote] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [pendingAIProposalCount, setPendingAIProposalCount] = useState(0);
  
  // 编辑状态
  const [isEditing, setIsEditing] = useState<EditState>({
    description: false,
    goal: false,
    content: false,
    milestone: false,
    timeline: false,
    status: false,
  });
  
  // 编辑中的值
  const [editValues, setEditValues] = useState({
    description: '',
    goal: '',
    content: '',
    milestone: '',
    timelineStart: '',
    timelineEnd: '',
    status: 'active' as 'active' | 'completed' | 'on-hold',
  });

  const activeTab = (() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const projectIndex = segments.findIndex((segment) => segment === 'project');
    const tabSegment = projectIndex >= 0 ? segments[projectIndex + 2] : undefined;
    const validTabs: TabType[] = ['overview', 'tasks', 'bugs', 'documents', 'ai', 'prototypes', 'repositories'];
    return validTabs.includes(tabSegment as TabType) ? (tabSegment as TabType) : 'overview';
  })();
  const previousActiveTabRef = useRef<TabType>(activeTab);

  const navigateToTab = (tab: TabType) => {
    if (!projectId) return;
    navigate(`/project/${projectId}/${tab}`);
  };

  const routeTaskId = taskId ? parseInt(taskId, 10) : null;
  const routeBugId = bugId ? parseInt(bugId, 10) : null;
  const taskViewTab: TaskViewTab = taskView === 'done' ? 'done' : taskView === 'mine' ? 'mine' : 'in-progress';
  const bugViewTab: BugViewTab = bugView === 'resolved' ? 'resolved' : bugView === 'mine' ? 'mine' : 'pending';

  const getTaskViewTabByStatus = (status: ApiTask['status']): TaskViewTab => {
    return status === 'done' ? 'done' : 'in-progress';
  };

  const getBugViewTabByStatus = (status: ApiBug['status']): BugViewTab => {
    return status === 'fixed' || status === 'closed' ? 'resolved' : 'pending';
  };

  const navigateToTask = (nextTaskId?: number, nextTaskView: TaskViewTab = taskViewTab) => {
    if (!projectId) return;
    navigate(nextTaskId ? `/project/${projectId}/tasks/${nextTaskView}/${nextTaskId}` : `/project/${projectId}/tasks/${nextTaskView}`);
  };
  const fetchTaskDetail = async (currentProjectId: number, currentTaskId: number) => {
    const task = await taskApi.getTask(currentProjectId, currentTaskId);
    setFocusedTask(task);
    return task;
  };


  const navigateToBug = (nextBugId?: number, nextBugView: BugViewTab = bugViewTab) => {
    if (!projectId) return;
    navigate(nextBugId ? `/project/${projectId}/bugs/${nextBugView}/${nextBugId}` : `/project/${projectId}/bugs/${nextBugView}`);
  };

  const fetchBugDetail = async (currentProjectId: number, currentBugId: number) => {
    const bug = await bugApi.get(currentProjectId, currentBugId);
    setFocusedBug(bug);
    return bug;
  };

  useEffect(() => {
    projectStore.fetchProjects();
  }, [projectStore]);

  useEffect(() => {
    if (!projectId) return;
    const id = parseInt(projectId, 10);
    if (Number.isNaN(id)) return;

    projectStore.fetchProjectDetail(id);
    projectStore.setActiveProject(id);

    loadMembers(id);
    void loadPendingAIProposalCount(id);
  }, [projectId, projectStore]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setTaskSearch(taskSearchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [taskSearchInput]);

  useEffect(() => {
    setTaskPage(1);
  }, [taskViewTab, taskSearch]);

  useEffect(() => {
    setFocusedTask(null);
    setProjectTasks([]);
    setTaskTotal(0);
  }, [taskViewTab]);

  useEffect(() => {
    if (!projectId) return;
    const id = parseInt(projectId, 10);
    if (Number.isNaN(id)) return;

    fetchTasks(id);
  }, [projectId, taskViewTab, taskSearch, taskPage, taskPageSize, currentUser?.id]);

  useEffect(() => {
    if (!projectId || !routeTaskId) {
      setFocusedTask(null);
      return;
    }

    const id = parseInt(projectId, 10);
    if (Number.isNaN(id)) return;

    let cancelled = false;

    const loadTaskDetail = async () => {
      try {
        const task = await fetchTaskDetail(id, routeTaskId);
        if (cancelled) return;
        if (taskViewTab === 'mine') {
          if (task.assignee_id !== currentUser?.id) {
            navigateToTask();
          }
          return;
        }
        const nextTaskView = getTaskViewTabByStatus(task.status);
        if (nextTaskView !== taskViewTab) {
          navigateToTask(routeTaskId, nextTaskView);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          setFocusedTask(null);
          navigateToTask();
        }
      }
    };

    void loadTaskDetail();

    return () => {
      cancelled = true;
    };
  }, [projectId, routeTaskId, taskViewTab, currentUser?.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBugSearch(bugSearchInput.trim());
    }, 300);

    return () => window.clearTimeout(timer);
  }, [bugSearchInput]);

  useEffect(() => {
    setFocusedBug(null);
    setBugs([]);
    setBugTotal(0);
  }, [bugViewTab]);

  useEffect(() => {
    setBugPage(1);
  }, [bugViewTab, bugSearch]);

  useEffect(() => {
    if (!projectId) return;
    const id = parseInt(projectId, 10);
    if (Number.isNaN(id)) return;

    fetchBugs(id);
  }, [projectId, bugViewTab, bugSearch, bugPage, bugPageSize, currentUser?.id]);

  useEffect(() => {
    if (!projectId || !routeBugId) {
      setFocusedBug(null);
      return;
    }

    const id = parseInt(projectId, 10);
    if (Number.isNaN(id)) return;

    let cancelled = false;

    const loadBugDetail = async () => {
      try {
        const bug = await fetchBugDetail(id, routeBugId);
        if (cancelled) return;
        if (bugViewTab === 'mine') {
          if (bug.assignee_id !== currentUser?.id) {
            navigateToBug();
          }
          return;
        }
        const nextBugView = getBugViewTabByStatus(bug.status);
        if (nextBugView !== bugViewTab) {
          navigateToBug(routeBugId, nextBugView);
          return;
        }
      } catch (error) {
        if (!cancelled) {
          setFocusedBug(null);
          navigateToBug();
        }
      }
    };

    void loadBugDetail();

    return () => {
      cancelled = true;
    };
  }, [projectId, routeBugId, bugViewTab, currentUser?.id]);

  const loadMembers = async (projectId: number) => {
    try {
      const membersList = await projectApi.getMembers(projectId);
      const membersWithUsers = await Promise.all(
        membersList.map(async (member) => {
          try {
            const user = await userApi.getUser(member.user_id);
            return {
              ...member,
              user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name,
                avatar: user.avatar_url,
              },
            };
          } catch (error) {
            return member;
          }
        })
      );
      setMembers(membersWithUsers);
    } catch (error) {
      console.error('Failed to load members:', error);
      setMembers([]);
    }
  };

  const loadPendingAIProposalCount = async (currentProjectId: number) => {
    try {
      const pendingProposals = await projectApi.getAIProposals(currentProjectId, { status: 'pending' });
      setPendingAIProposalCount(pendingProposals.length);
    } catch (error) {
      console.error('Failed to load pending AI proposal count:', error);
      setPendingAIProposalCount(0);
    }
  };

  const project = projectId
    ? projectStore.getProjectById(parseInt(projectId, 10))
    : null;

  // 初始化编辑值
  useEffect(() => {
    if (project) {
      const timeline = parseTimeline(project.timeline || null);
      setEditValues({
        description: project.description || '',
        goal: project.goal || '',
        content: project.content || '',
        timelineStart: timeline.start !== '—' ? timeline.start : '',
        timelineEnd: timeline.end !== '—' ? timeline.end : '',
        status: project.status,
      });
    }
  }, [project?.id]);

  const parseTimeline = (timeline?: string | null) => {
    if (!timeline) return { start: '—', end: '—' };
    const parts = timeline.split(' to ');
    if (parts.length === 2) {
      return { start: parts[0], end: parts[1] };
    }
    return { start: timeline, end: '—' };
  };

  const formatDate = (date?: Date) => {
    if (!date) return '—';
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const timeline = parseTimeline(project?.timeline || null);

  const handleOpenChat = async () => {
    if (!project) return;

    try {
      const chat = await projectApi.openProjectChat(project.id);
      chatStore.addChat(chat);
      chatStore.setActiveChat(chat.id);
      navigate(`/chat/${chat.id}`);
    } catch (error) {
      console.error('Failed to open project chat:', error);
      alert('打开项目群聊失败，请重试');
    }
  };

  const startEdit = (field: keyof EditState) => {
    setIsEditing({ ...isEditing, [field]: true });
  };

  const cancelEdit = (field: keyof EditState) => {
    if (project) {
      const timeline = parseTimeline(project.timeline || null);
      setEditValues({
        description: project.description || '',
        goal: project.goal || '',
        content: project.content || '',
        timelineStart: timeline.start !== '—' ? timeline.start : '',
        timelineEnd: timeline.end !== '—' ? timeline.end : '',
        status: project.status,
      });
    }
    setIsEditing({ ...isEditing, [field]: false });
  };

  const saveEdit = async (field: keyof EditState) => {
    if (!project) return;

    try {
      let updateData: any = {};
      
      if (field === 'description') {
        updateData.description = editValues.description;
      } else if (field === 'goal') {
        updateData.goal = editValues.goal;
      } else if (field === 'content') {
        updateData.content = editValues.content;
      } else if (field === 'milestone') {
        updateData.milestone = editValues.milestone;
      } else if (field === 'timeline') {
        if (editValues.timelineStart && editValues.timelineEnd) {
          updateData.timeline = `${editValues.timelineStart} to ${editValues.timelineEnd}`;
        }
      } else if (field === 'status') {
        updateData.status = editValues.status;
      }

      await projectStore.updateProject(project.id, updateData);
      setIsEditing({ ...isEditing, [field]: false });
    } catch (error) {
      console.error('Failed to update project:', error);
      alert('更新失败，请重试');
    }
  };

  const handleAddMemberSuccess = () => {
    if (projectId) {
      loadMembers(parseInt(projectId, 10));
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!project || !window.confirm('确定要移除该成员吗？')) return;

    try {
      await projectApi.removeMember(project.id, memberId);
      await loadMembers(project.id);
    } catch (error: any) {
      console.error('Failed to remove member:', error);
      alert(error.message || '移除成员失败，请重试');
    }
  };

  const handleChangeRole = async (memberId: number, newRole: 'owner' | 'member' | 'viewer') => {
    if (!project) return;

    try {
      await projectApi.updateMemberRole(project.id, memberId, newRole);
      await loadMembers(project.id);
    } catch (error: any) {
      console.error('Failed to change role:', error);
      alert(error.message || '修改角色失败，请重试');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!project || !window.confirm('确定要删除该任务吗？')) return;

    try {
      await taskApi.deleteTask(project.id, taskId);
      if (routeTaskId === taskId) {
        navigateToTask();
      }
      await fetchTasks(project.id);
    } catch (error: any) {
      console.error('删除任务失败:', error);
      alert(error.message || '删除失败，请重试');
    }
  };

  const handleUpdateTaskProgress = async (task: ApiTask) => {
    if (!project) return;

    const trimmedStatusNote = taskStatusNote.trim();
    if (!trimmedStatusNote) {
      alert('修改任务进度时必须填写说明');
      return;
    }

    try {
      await taskApi.updateTask(project.id, task.id, {
        progress: taskProgressDraft,
        statusNote: trimmedStatusNote,
      });
      await fetchTasks(project.id);
      if (routeTaskId === task.id) {
        await fetchTaskDetail(project.id, task.id);
      }
      setTaskStatusNote('');
    } catch (error: any) {
      console.error('更新任务进度失败:', error);
      alert(error.message || '更新失败，请重试');
    }
  };

  const handleUpdateTaskStatus = async (task: ApiTask, status: ApiTask['status']) => {
    if (!project) return;

    const trimmedStatusNote = taskStatusNote.trim();
    if (!trimmedStatusNote) {
      alert('修改任务状态时必须填写说明');
      return;
    }

    try {
      await taskApi.updateTask(project.id, task.id, {
        status,
        statusNote: trimmedStatusNote,
        progress: status === 'done' ? 100 : task.progress,
      });
      await fetchTasks(project.id);
      await fetchTaskDetail(project.id, task.id);
      navigateToTask(task.id, taskViewTab === 'mine' && task.assignee_id === currentUser?.id ? 'mine' : getTaskViewTabByStatus(status));
      setTaskStatusNote('');
    } catch (error: any) {
      console.error('更新任务状态失败:', error);
      alert(error.message || '更新失败，请重试');
    }
  };

  const fetchTasks = async (projectId: number) => {
    setTasksLoading(true);
    try {
      if (taskViewTab === 'mine' && !currentUser?.id) {
        setProjectTasks([]);
        setTaskTotal(0);
        return;
      }

      const status = taskViewTab === 'in-progress' ? 'todo,in-progress' : taskViewTab === 'done' ? 'done' : undefined;
      const response = await taskApi.getTasks(projectId, {
        status,
        assigneeId: taskViewTab === 'mine' ? currentUser?.id : undefined,
        q: taskSearch || undefined,
        page: taskPage,
        pageSize: taskPageSize,
      });
      setProjectTasks(response.items);
      setTaskTotal(response.pagination.total);
    } catch (error) {
      console.error('加载任务列表失败:', error);
      setProjectTasks([]);
      setTaskTotal(0);
    } finally {
      setTasksLoading(false);
    }
  };

  const handleTaskCreateSuccess = () => {
    if (project) {
      fetchTasks(project.id);
    }
  };

  const handleTaskEditSuccess = () => {
    if (project) {
      fetchTasks(project.id);
      if (routeTaskId) {
        void fetchTaskDetail(project.id, routeTaskId);
      }
    }
  };

  const handleEditTask = (task: ApiTask) => {
    navigateToTask(task.id, taskViewTab === 'mine' && task.assignee_id === currentUser?.id ? 'mine' : getTaskViewTabByStatus(task.status));
    setEditingTask(task);
    setIsEditTaskModalOpen(true);
  };

  const parseBugImages = (images?: string) => {
    if (!images) return [] as string[];

    try {
      const parsed = JSON.parse(images);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error('解析图片数据失败:', error);
      return [] as string[];
    }
  };

  // Bug 相关函数
  const fetchBugs = async (projectId: number) => {
    setBugsLoading(true);
    try {
      if (bugViewTab === 'mine' && !currentUser?.id) {
        setBugs([]);
        setBugTotal(0);
        return;
      }

      const status = bugViewTab === 'pending' ? 'open,in-progress' : bugViewTab === 'resolved' ? 'fixed,closed' : undefined;
      const response = await bugApi.list(projectId, {
        status,
        assigneeId: bugViewTab === 'mine' ? currentUser?.id : undefined,
        q: bugSearch || undefined,
        page: bugPage,
        pageSize: bugPageSize,
      });
      setBugs(response.items);
      setBugTotal(response.pagination.total);
    } catch (error) {
      console.error('加载缺陷列表失败:', error);
      setBugs([]);
      setBugTotal(0);
    } finally {
      setBugsLoading(false);
    }
  };

  const handleBugCreateSuccess = () => {
    if (project) {
      fetchBugs(project.id);
    }
  };

  const handleBugEditSuccess = () => {
    if (project) {
      fetchBugs(project.id);
      if (routeBugId) {
        void fetchBugDetail(project.id, routeBugId);
      }
    }
  };

  const handleEditBug = (bug: ApiBug) => {
    navigateToBug(bug.id, bugViewTab === 'mine' && bug.assignee_id === currentUser?.id ? 'mine' : getBugViewTabByStatus(bug.status));
    setEditingBug(bug);
    setIsEditBugModalOpen(true);
  };

  const handleUpdateBugStatus = async (bugId: number, status: 'open' | 'in-progress' | 'fixed' | 'closed') => {
    if (!project) return;
    const trimmedStatusNote = bugStatusNote.trim();

    if (!trimmedStatusNote) {
      alert('修改缺陷状态时必须填写说明');
      return;
    }

    try {
      await bugApi.update(project.id, bugId, { status, statusNote: trimmedStatusNote });
      await fetchBugs(project.id);
      await fetchBugDetail(project.id, bugId);
      navigateToBug(bugId, bugViewTab === 'mine' && selectedBug?.assignee_id === currentUser?.id ? 'mine' : getBugViewTabByStatus(status));
      setBugStatusNote('');
    } catch (error: any) {
      console.error('更新缺陷状态失败:', error);
      alert(error.message || '更新失败，请重试');
    }
  };

  const handleAssignBug = async (bugId: number, assigneeId: number | null) => {
    if (!project) return;

    try {
      await bugApi.update(project.id, bugId, { assigneeId: assigneeId || undefined });
      await fetchBugs(project.id);
      if (routeBugId === bugId) {
        await fetchBugDetail(project.id, bugId);
      }
    } catch (error: any) {
      console.error('指派缺陷失败:', error);
      alert(error.message || '指派失败，请重试');
    }
  };

  const handleDeleteBug = async (bugId: number) => {
    if (!project || !window.confirm('确定要删除该缺陷吗？')) return;

    try {
      await bugApi.delete(project.id, bugId);
      if (routeBugId === bugId) {
        navigateToBug();
      }
      await fetchBugs(project.id);
    } catch (error: any) {
      console.error('删除缺陷失败:', error);
      alert(error.message || '删除失败，请重试');
    }
  };

  // 获取当前用户在项目中的权限
  const currentUserMember = members.find((m) => m.user_id === currentUser?.id);
  const canManageMembers = currentUserMember?.role === 'owner' || currentUserMember?.role === 'member';
  const isOwner = currentUserMember?.role === 'owner';
  const currentUserRoleLabel = currentUserMember?.role === 'owner'
    ? '项目负责人'
    : currentUserMember?.role === 'member'
      ? '项目成员'
      : currentUserMember?.role === 'viewer'
        ? '只读成员'
        : '未加入项目';
  const taskTotalPages = Math.max(1, Math.ceil(taskTotal / taskPageSize));
  const bugTotalPages = Math.max(1, Math.ceil(bugTotal / bugPageSize));
  const taskItemsForCurrentView = taskViewTab === 'mine'
    ? projectTasks.filter((task) => task.assignee_id === currentUser?.id)
    : projectTasks.filter((task) => getTaskViewTabByStatus(task.status) === taskViewTab);
  const focusedTaskMatchesView = focusedTask
    ? taskViewTab === 'mine'
      ? focusedTask.assignee_id === currentUser?.id
      : getTaskViewTabByStatus(focusedTask.status) === taskViewTab
    : false;
  const visibleTasks = focusedTaskMatchesView && focusedTask && !taskItemsForCurrentView.some((task) => task.id === focusedTask.id)
    ? [focusedTask, ...taskItemsForCurrentView]
    : taskItemsForCurrentView;
  const bugItemsForCurrentView = bugViewTab === 'mine'
    ? bugs.filter((bug) => bug.assignee_id === currentUser?.id)
    : bugs.filter((bug) => getBugViewTabByStatus(bug.status) === bugViewTab);
  const focusedBugMatchesView = focusedBug
    ? bugViewTab === 'mine'
      ? focusedBug.assignee_id === currentUser?.id
      : getBugViewTabByStatus(focusedBug.status) === bugViewTab
    : false;
  const visibleBugs = focusedBugMatchesView && focusedBug && !bugItemsForCurrentView.some((bug) => bug.id === focusedBug.id)
    ? [focusedBug, ...bugItemsForCurrentView]
    : bugItemsForCurrentView;
  const selectedTaskFromList = routeTaskId
    ? visibleTasks.find((task) => task.id === routeTaskId) || null
    : visibleTasks[0] || null;
  const selectedBugFromList = routeBugId
    ? visibleBugs.find((bug) => bug.id === routeBugId) || null
    : visibleBugs[0] || null;
  const selectedTask = routeTaskId
    ? (focusedTask?.id === routeTaskId ? focusedTask : selectedTaskFromList || focusedTask)
    : selectedTaskFromList;
  const selectedBug = routeBugId
    ? (focusedBug?.id === routeBugId ? focusedBug : selectedBugFromList || focusedBug)
    : selectedBugFromList;
  const isTaskProgressDirty = selectedTask ? taskProgressDraft !== (selectedTask.progress || 0) : false;
  const taskTimelineItems = selectedTask
    ? selectedTask.status_history && selectedTask.status_history.length > 0
      ? selectedTask.status_history
      : selectedTask.status_note
        ? [
            {
              id: `legacy-${selectedTask.id}`,
              task_id: selectedTask.id,
              from_status: undefined,
              to_status: selectedTask.status,
              note: selectedTask.status_note,
              changed_by: selectedTask.created_by,
              created_at: selectedTask.updated_at,
            },
          ]
        : [
            {
              id: `created-${selectedTask.id}`,
              task_id: selectedTask.id,
              from_status: undefined,
              to_status: selectedTask.status,
              note: '创建任务',
              changed_by: selectedTask.created_by,
              created_at: selectedTask.created_at,
            },
          ]
    : [];
  const bugTimelineItems = selectedBug
    ? selectedBug.status_history && selectedBug.status_history.length > 0
      ? selectedBug.status_history
      : selectedBug.status_note
        ? [
            {
              id: `legacy-${selectedBug.id}`,
              bug_id: selectedBug.id,
              from_status: undefined,
              to_status: selectedBug.status,
              note: selectedBug.status_note,
              changed_by: selectedBug.reporter_id,
              created_at: selectedBug.updated_at,
              changed_by_user: selectedBug.reporter,
            },
          ]
        : [
            {
              id: `created-${selectedBug.id}`,
              bug_id: selectedBug.id,
              from_status: undefined,
              to_status: selectedBug.status,
              note: '已报告缺陷，等待后续处理。',
              changed_by: selectedBug.reporter_id,
              created_at: selectedBug.created_at,
              changed_by_user: selectedBug.reporter,
            },
          ]
    : [];

  useEffect(() => {
    setTaskStatusNote('');
  }, [routeTaskId]);

  useEffect(() => {
    setTaskProgressDraft(selectedTask?.progress || 0);
  }, [selectedTask?.id, selectedTask?.progress]);

  useEffect(() => {
    setBugStatusNote('');
  }, [routeBugId]);

  const getTaskStatusLabel = (status: ApiTask['status']) => {
    if (status === 'done') return '已完成';
    if (status === 'in-progress') return '进行中';
    return '待办';
  };

  const getTaskPriorityLabel = (priority: ApiTask['priority']) => {
    if (priority === 'high') return '高';
    if (priority === 'medium') return '中';
    return '低';
  };

  const getTaskStatusTransitionLabel = (fromStatus?: ApiTask['status'], toStatus?: ApiTask['status']) => {
    if (!fromStatus) {
      return '创建任务';
    }

    if (fromStatus !== 'done' && toStatus === 'done') {
      return '完成任务';
    }

    return '更新任务';
  };

  const getBugSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'medium':
        return 'bg-yellow-100 text-yellow-700';
      case 'low':
      default:
        return 'bg-gray-100 text-gray-600';
    }
  };

  const getBugSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical':
        return '紧急';
      case 'high':
        return '高';
      case 'medium':
        return '中';
      case 'low':
        return '低';
      default:
        return severity;
    }
  };

  const getBugStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
        return '待处理';
      case 'in-progress':
        return '处理中';
      case 'fixed':
        return '已修复';
      case 'closed':
        return '已关闭';
      default:
        return status;
    }
  };

  const getBugStatusTransitionLabel = (fromStatus?: string, toStatus?: string) => {
    if (!fromStatus) {
      return '报告缺陷';
    }

    return `${getBugStatusLabel(fromStatus)} -> ${getBugStatusLabel(toStatus || fromStatus)}`;
  };

  useEffect(() => {
    if (activeTab === 'tasks' && !routeTaskId && visibleTasks.length > 0) {
      navigateToTask(visibleTasks[0].id);
    }
  }, [activeTab, routeTaskId, visibleTasks.length]);

  useEffect(() => {
    const previousTab = previousActiveTabRef.current;
    previousActiveTabRef.current = activeTab;

    if (activeTab !== 'tasks' || previousTab === 'tasks' || !projectId) {
      return;
    }

    const id = parseInt(projectId, 10);
    if (Number.isNaN(id)) {
      return;
    }

    void fetchTasks(id);
    if (routeTaskId) {
      void fetchTaskDetail(id, routeTaskId);
    }
  }, [activeTab, projectId, routeTaskId]);

  useEffect(() => {
    if (activeTab === 'bugs' && !routeBugId && visibleBugs.length > 0) {
      navigateToBug(visibleBugs[0].id, bugViewTab);
    }
  }, [activeTab, routeBugId, visibleBugs.length, bugViewTab]);

  useEffect(() => {
    if (activeTab !== 'tasks' || !routeTaskId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`task-card-${routeTaskId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [activeTab, routeTaskId, visibleTasks.length]);

  useEffect(() => {
    if (activeTab !== 'bugs' || !routeBugId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`bug-card-${routeBugId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [activeTab, routeBugId, visibleBugs.length]);

  return (
    <div className="flex-1 flex flex-col bg-white">
      {!project ? (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          {projectStore.isLoading ? 'Loading...' : 'Select a project to view details'}
        </div>
      ) : (
        <>
            {/* Header */}
            <div className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-8">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
                  <div className="flex items-center gap-4 text-sm">
                    {!isEditing.status ? (
                      <>
                        <span className="flex items-center gap-2 bg-white/20 px-3 py-1 rounded-full uppercase text-xs font-semibold">
                          {project.status}
                        </span>
                        <button
                          onClick={() => startEdit('status')}
                          className="text-white/80 hover:text-white flex items-center gap-1"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <select
                          value={editValues.status}
                          onChange={(e) => setEditValues({ ...editValues, status: e.target.value as any })}
                          className="bg-white/20 text-white px-3 py-1 rounded-full text-xs font-semibold uppercase focus:outline-none focus:ring-2 focus:ring-white/50"
                        >
                          <option value="active" className="text-gray-900">Active</option>
                          <option value="on-hold" className="text-gray-900">On-hold</option>
                          <option value="completed" className="text-gray-900">Completed</option>
                        </select>
                        <button
                          onClick={() => saveEdit('status')}
                          className="text-white hover:bg-white/20 p-1 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => cancelEdit('status')}
                          className="text-white hover:bg-white/20 p-1 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    )}
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      <span>{members.length} 联系人</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200 bg-white">
              <div className="flex gap-8 px-8">
                {[
                  { key: 'overview', label: '项目详情' },
                  { key: 'tasks', label: '任务' },
                  { key: 'bugs', label: '缺陷' },
                  { key: 'documents', label: '文档' },
                  { key: 'ai', label: 'AI管理' },
                  { key: 'prototypes', label: '原型稿' },
                  { key: 'repositories', label: '代码' },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => navigateToTab(tab.key as TabType)}
                    className={`py-3 border-b-2 transition-colors ${
                      activeTab === tab.key
                        ? 'border-emerald-600 text-emerald-600 font-medium'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span>{tab.label}</span>
                      {tab.key === 'ai' && isOwner && pendingAIProposalCount > 0 ? (
                        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                          {pendingAIProposalCount}
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              <div className="max-w-7xl mx-auto p-8">
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Content - 2 columns */}
                    <div className="lg:col-span-2 space-y-6">
                      {/* Project Description */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            简短描述
                          </h3>
                          {!isEditing.description ? (
                            <button
                              onClick={() => startEdit('description')}
                              className="text-gray-400 hover:text-emerald-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit('description')}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => cancelEdit('description')}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {!isEditing.description ? (
                          <div className="border-l-4 border-blue-500 pl-4 py-2 mt-2">
                            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                              {project.description || '暂无描述'}
                            </p>
                          </div>
                        ) : (
                          <textarea
                            value={editValues.description}
                            onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[80px]"
                            placeholder="输入项目简短描述..."
                          />
                        )}
                      </div>

                      {/* Project Goal */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            项目目标
                          </h3>
                          {!isEditing.goal ? (
                            <button
                              onClick={() => startEdit('goal')}
                              className="text-gray-400 hover:text-emerald-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit('goal')}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => cancelEdit('goal')}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {!isEditing.goal ? (
                          <div className="border-l-4 border-emerald-500 pl-4 py-2">
                            <p className="text-gray-700 italic text-sm leading-relaxed">
                              "{project.goal || '暂无目标'}"
                            </p>
                          </div>
                        ) : (
                          <textarea
                            value={editValues.goal}
                            onChange={(e) => setEditValues({ ...editValues, goal: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            rows={3}
                            placeholder="输入项目目标..."
                          />
                        )}
                      </div>

                      {/* Project Milestone */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            项目里程碑
                          </h3>
                          {!isEditing.milestone ? (
                            <button
                              onClick={() => startEdit('milestone')}
                              className="text-gray-400 hover:text-emerald-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit('milestone')}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => cancelEdit('milestone')}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {!isEditing.milestone ? (
                          <div className="border-l-4 border-emerald-500 pl-4 py-2 mt-2">
                            <p className="text-gray-700 whitespace-pre-wrap text-sm leading-relaxed">
                              {project.milestone || '暂无里程碑计划'}
                            </p>
                          </div>
                        ) : (
                          <textarea
                            value={editValues.milestone}
                            onChange={(e) => setEditValues({ ...editValues, milestone: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[120px]"
                            placeholder="输入项目里程碑计划..."
                          />
                        )}
                      </div>

                      {/* Project Content */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            项目内容
                          </h3>
                          {!isEditing.content ? (
                            <button
                              onClick={() => startEdit('content')}
                              className="text-gray-400 hover:text-emerald-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit('content')}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => cancelEdit('content')}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {!isEditing.content ? (
                          <p className="text-gray-700 text-sm leading-relaxed">
                            {project.content || '暂无项目内容'}
                          </p>
                        ) : (
                          <textarea
                            value={editValues.content}
                            onChange={(e) => setEditValues({ ...editValues, content: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            rows={4}
                            placeholder="输入项目内容..."
                          />
                        )}
                      </div>

                      {/* Git Repositories */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            GIT 仓库
                          </h3>
                          <span className="text-xs text-gray-400 italic">示例数据</span>
                        </div>
                        <div className="text-center py-8 text-gray-400">
                          <svg className="w-12 h-12 mx-auto mb-2 opacity-30" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                          </svg>
                          <p className="text-sm">暂无仓库</p>
                          <p className="text-xs mt-1">仓库管理功能待开发</p>
                        </div>
                      </div>
                    </div>

                    {/* Sidebar - 1 column */}
                    <div className="space-y-6">
                      {/* Timeline */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            时间周期
                          </h3>
                          {!isEditing.timeline ? (
                            <button
                              onClick={() => startEdit('timeline')}
                              className="text-gray-400 hover:text-emerald-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                          ) : (
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit('timeline')}
                                className="text-emerald-600 hover:text-emerald-700"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              <button
                                onClick={() => cancelEdit('timeline')}
                                className="text-gray-400 hover:text-gray-600"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          )}
                        </div>
                        {!isEditing.timeline ? (
                          <div className="flex items-center gap-2 text-sm">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-gray-600">{timeline.start} to {timeline.end}</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">开始日期</label>
                              <input
                                type="date"
                                value={editValues.timelineStart}
                                onChange={(e) => setEditValues({ ...editValues, timelineStart: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">结束日期</label>
                              <input
                                type="date"
                                value={editValues.timelineEnd}
                                onChange={(e) => setEditValues({ ...editValues, timelineEnd: e.target.value })}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Project Lead */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <h3 className="text-xs uppercase tracking-wider text-gray-500 mb-4">
                          项目组长
                        </h3>
                        {members.find((m) => m.role === 'owner') ? (
                          <div className="flex items-center gap-3">
                            <img
                              src={getAvatarUrl(members.find((m) => m.role === 'owner')?.user?.avatar)}
                              alt={members.find((m) => m.role === 'owner')?.user?.displayName || ''}
                              className="w-10 h-10 rounded-full"
                            />
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                {members.find((m) => m.role === 'owner')?.user?.displayName || 
                                 members.find((m) => m.role === 'owner')?.user?.username || 'Unknown'}
                              </div>
                              <div className="text-xs text-gray-500">Owner</div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">No owner assigned</div>
                        )}
                      </div>

                      {/* Team Members */}
                      <div className="bg-white rounded-lg shadow-sm p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xs uppercase tracking-wider text-gray-500">
                            团队成员 ({members.filter((m) => m.role !== 'owner').length})
                          </h3>
                          {canManageMembers && (
                            <button
                              onClick={() => setIsAddMemberModalOpen(true)}
                              className="text-emerald-600 hover:text-emerald-700 flex items-center gap-1 text-sm font-medium"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              添加成员
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {members.filter((m) => m.role !== 'owner').length === 0 ? (
                            <div className="text-sm text-gray-500 text-center py-4">暂无成员</div>
                          ) : (
                            members
                              .filter((m) => m.role !== 'owner')
                              .map((member) => (
                                <div key={member.id} className="flex items-center gap-3 group">
                                  <img
                                    src={getAvatarUrl(member.user?.avatar)}
                                    alt={member.user?.displayName || ''}
                                    className="w-8 h-8 rounded-full flex-shrink-0"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-sm text-gray-900 truncate">
                                      {member.user?.displayName || member.user?.username || 'Unknown'}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isOwner ? (
                                        <select
                                          value={member.role}
                                          onChange={(e) => handleChangeRole(member.id, e.target.value as any)}
                                          className="text-xs border border-gray-200 rounded px-2 py-0.5 capitalize focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        >
                                          <option value="member">Member</option>
                                          <option value="viewer">Viewer</option>
                                        </select>
                                      ) : (
                                        <span className="text-xs text-gray-500 capitalize">{member.role}</span>
                                      )}
                                    </div>
                                  </div>
                                  {isOwner && (
                                    <button
                                      onClick={() => handleRemoveMember(member.id)}
                                      className="text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                      title="移除成员"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              ))
                          )}
                        </div>
                      </div>

                      {/* Open Chat Button */}
                      <button
                        onClick={handleOpenChat}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-medium py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        打开项目聊天
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'ai' && project && (
                  <div className="space-y-4">
                    {isOwner && pendingAIProposalCount > 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
                        当前有 <span className="font-semibold">{pendingAIProposalCount}</span> 条 AI 待确认内容，建议优先处理，避免项目任务、缺陷和文档更新积压。
                      </div>
                    ) : null}
                    <AIManagement
                      projectId={project.id}
                      isOwner={isOwner}
                      canTriggerSummary={canManageMembers}
                      onProjectChanged={async () => {
                        await projectStore.fetchProjectDetail(project.id);
                        await loadPendingAIProposalCount(project.id);
                      }}
                    />
                  </div>
                )}

                {activeTab === 'tasks' && (
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
                      <div className="border-b border-gray-100 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">任务管理</h2>
                            <p className="mt-1 text-sm text-gray-500">
                              {taskViewTab === 'mine' ? `当前项目角色：${currentUserRoleLabel}，仅显示分配给我的任务` : '支持进行中/已完成/我的分组、模糊搜索和分页查询'}
                            </p>
                          </div>
                          {canManageMembers && (
                            <IconActionButton
                              icon={Plus}
                              label="新建任务"
                              variant="emerald"
                              styleType="solid"
                              onClick={() => setIsCreateTaskModalOpen(true)}
                            />
                          )}
                        </div>

                        <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1 w-fit">
                          <button
                            type="button"
                            onClick={() => navigateToTask(undefined, 'in-progress')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              taskViewTab === 'in-progress'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            进行中的
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToTask(undefined, 'done')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              taskViewTab === 'done'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            已完成
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToTask(undefined, 'mine')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              taskViewTab === 'mine'
                                ? 'bg-white text-sky-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            我的
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            value={taskSearchInput}
                            onChange={(e) => setTaskSearchInput(e.target.value)}
                            placeholder="搜索任务标题或描述"
                            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>

                      {tasksLoading && <div className="p-6 text-center text-sm text-gray-500">加载中...</div>}

                      {!tasksLoading && visibleTasks.length === 0 && (
                        <div className="p-6 text-center text-sm text-gray-500">
                          {taskSearch ? '未找到匹配任务' : taskViewTab === 'mine' ? '当前没有分配给我的任务' : '暂无任务'}
                        </div>
                      )}

                      <div className="divide-y divide-gray-100">
                        {visibleTasks.map((task) => (
                          <div
                            id={`task-card-${task.id}`}
                            key={task.id}
                            onClick={() => navigateToTask(task.id, taskViewTab === 'mine' ? 'mine' : getTaskViewTabByStatus(task.status))}
                            className={`cursor-pointer p-4 transition-colors hover:bg-gray-50 ${routeTaskId === task.id ? 'bg-emerald-50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="truncate font-medium text-gray-900">{task.title}</h3>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${
                                    task.status === 'done'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : task.status === 'in-progress'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {getTaskStatusLabel(task.status)}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs text-gray-500">{task.description || '暂无任务描述'}</p>
                                <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5">优先级 {getTaskPriorityLabel(task.priority)}</span>
                                  <span>{task.assignee?.username || '未分配'}</span>
                                </div>
                              </div>
                              {canManageMembers && (
                                <div className="flex items-center gap-2">
                                  <IconActionButton
                                    icon={Pencil}
                                    label="编辑"
                                    variant="emerald"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditTask(task);
                                    }}
                                  />
                                  <IconActionButton
                                    icon={Trash2}
                                    label="删除"
                                    variant="red"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteTask(task.id);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!tasksLoading && taskTotal > 0 && (
                        <div className="flex items-center justify-between border-t border-gray-100 p-4 text-sm">
                          <span className="text-gray-500">第 {taskPage} / {taskTotalPages} 页，共 {taskTotal} 条</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setTaskPage((prev) => Math.max(1, prev - 1))}
                              disabled={taskPage <= 1}
                              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
                            >
                              上一页
                            </button>
                            <button
                              type="button"
                              onClick={() => setTaskPage((prev) => Math.min(taskTotalPages, prev + 1))}
                              disabled={taskPage >= taskTotalPages}
                              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
                            >
                              下一页
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-h-[720px]">
                      {!selectedTask ? (
                        <div className="flex min-h-[720px] items-center justify-center rounded-lg border border-gray-100 bg-white text-sm text-gray-500 shadow-sm">
                          请选择左侧任务查看详情
                        </div>
                      ) : (
                        <div className="min-h-[720px] rounded-lg border border-gray-100 bg-white shadow-sm flex flex-col">
                          <div className="border-b border-gray-100 px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-2xl font-semibold text-gray-900">{selectedTask.title}</h2>
                                  <span className={`rounded-full px-2.5 py-1 text-xs ${
                                    selectedTask.status === 'done'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : selectedTask.status === 'in-progress'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {getTaskStatusLabel(selectedTask.status)}
                                  </span>
                                  <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">优先级 {getTaskPriorityLabel(selectedTask.priority)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                  <span>任务 #{selectedTask.id}</span>
                                  <span>创建人：#{selectedTask.created_by}</span>
                                  <span>负责人：{selectedTask.assignee?.username || '未分配'}</span>
                                  <span>开始：{selectedTask.start_date || '未设置'}</span>
                                  <span>结束：{selectedTask.end_date || '未设置'}</span>
                                  <span>创建于：{formatDateTime(selectedTask.created_at)}</span>
                                  <span>更新于：{formatDateTime(selectedTask.updated_at)}</span>
                                </div>
                              </div>

                              {canManageMembers && (
                                <div className="flex items-center gap-2">
                                  <IconActionButton
                                    icon={Pencil}
                                    label="编辑任务"
                                    variant="neutral"
                                    onClick={() => handleEditTask(selectedTask)}
                                  />
                                  <IconActionButton
                                    icon={Trash2}
                                    label="删除任务"
                                    variant="red"
                                    onClick={() => handleDeleteTask(selectedTask.id)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 space-y-6 px-6 py-6">
                            <section className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                              <h3 className="text-base font-semibold text-gray-900">任务描述</h3>
                              <p className="mt-3 text-sm leading-relaxed text-gray-600">{selectedTask.description || '暂无任务描述'}</p>
                            </section>

                            <section className="rounded-2xl border border-gray-100 bg-white p-5">
                              <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900">任务进度</h3>
                                <span className="text-sm font-medium text-gray-700">{taskProgressDraft}%</span>
                              </div>
                              <div className="mb-4 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                                <div className="h-full rounded-full bg-emerald-600" style={{ width: `${taskProgressDraft}%` }} />
                              </div>
                              {canManageMembers && (
                                <div>
                                  <label className="mb-2 block text-sm text-gray-500">快速调整进度</label>
                                  <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={taskProgressDraft}
                                    onChange={(e) => setTaskProgressDraft(parseInt(e.target.value, 10))}
                                    className="w-full accent-emerald-600"
                                  />
                                  {isTaskProgressDirty && (
                                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                      进度已调整为 {taskProgressDraft}%。请填写处理说明并点击“保存进度”后再提交。
                                    </div>
                                  )}
                                </div>
                              )}
                            </section>

                            {canManageMembers && (
                              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                                <h3 className="text-base font-semibold text-gray-900">处理操作</h3>
                                <p className="mt-2 text-sm text-gray-500">
                                  {isTaskProgressDirty
                                    ? '进度修改需要填写处理说明，确认后才会保存，并同步写入时间线。'
                                    : '任务状态流转需要填写说明，说明会记录到状态时间线中。'}
                                </p>
                                <textarea
                                  value={taskStatusNote}
                                  onChange={(e) => setTaskStatusNote(e.target.value)}
                                  rows={3}
                                  placeholder={isTaskProgressDirty ? '请输入本次进度更新的处理说明...' : '请输入本次任务状态变更说明...'}
                                  className="mt-4 w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <div className="mt-4 flex flex-wrap gap-3">
                                  {isTaskProgressDirty && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTaskProgress(selectedTask)}
                                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                                      >
                                        保存进度
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTaskProgressDraft(selectedTask.progress || 0);
                                          setTaskStatusNote('');
                                        }}
                                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                      >
                                        取消进度修改
                                      </button>
                                    </>
                                  )}
                                  {selectedTask.status === 'todo' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTaskStatus(selectedTask, 'in-progress')}
                                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                    >
                                      开始处理
                                    </button>
                                  )}
                                  {selectedTask.status === 'in-progress' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTaskStatus(selectedTask, 'done')}
                                        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                                      >
                                        标记完成
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleUpdateTaskStatus(selectedTask, 'todo')}
                                        className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                                      >
                                        退回待办
                                      </button>
                                    </>
                                  )}
                                  {selectedTask.status === 'done' && (
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateTaskStatus(selectedTask, 'in-progress')}
                                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                                    >
                                      重新打开
                                    </button>
                                  )}
                                </div>
                              </section>
                            )}

                            <section className="rounded-2xl border border-gray-100 bg-white p-5">
                              <div className="flex items-center justify-between">
                                <h3 className="text-base font-semibold text-gray-900">状态时间线</h3>
                                <span className="text-sm text-gray-400">{taskTimelineItems.length} 条记录</span>
                              </div>
                              <div className="mt-5 space-y-5">
                                {taskTimelineItems.map((item, index) => (
                                  <div key={item.id} className="relative pl-8">
                                    {index < taskTimelineItems.length - 1 && (
                                      <div className="absolute left-[11px] top-6 h-[calc(100%+12px)] w-px bg-gray-200" />
                                    )}
                                    <div className="absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                                      <div className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                                    </div>
                                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="text-sm font-semibold text-gray-900">
                                          {getTaskStatusTransitionLabel(item.from_status, item.to_status)}
                                        </div>
                                        <div className="text-xs text-gray-400">{formatDateTime(item.created_at)}</div>
                                      </div>
                                      <div className="mt-2 text-sm leading-relaxed text-gray-600">{item.note}</div>
                                      <div className="mt-3 text-xs text-gray-500">
                                        操作人：{item.changed_by_user?.username || `用户 #${item.changed_by}`}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </section>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'bugs' && (
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                    <div className="rounded-lg border border-gray-100 bg-white shadow-sm">
                      <div className="border-b border-gray-100 p-4">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-semibold text-gray-900">缺陷管理</h2>
                            <p className="mt-1 text-sm text-gray-500">
                              {bugViewTab === 'mine' ? `当前项目角色：${currentUserRoleLabel}，仅显示分配给我的缺陷` : '支持按状态分组、关键词搜索、我的筛选和分页查询'}
                            </p>
                          </div>
                          {canManageMembers && (
                            <IconActionButton
                              icon={Bug}
                              label="报告缺陷"
                              variant="red"
                              styleType="solid"
                              onClick={() => setIsCreateBugModalOpen(true)}
                            />
                          )}
                        </div>

                        <div className="mb-4 inline-flex rounded-lg bg-gray-100 p-1 w-fit">
                          <button
                            type="button"
                            onClick={() => navigateToBug(undefined, 'pending')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              bugViewTab === 'pending'
                                ? 'bg-white text-red-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            待处理问题
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToBug(undefined, 'resolved')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              bugViewTab === 'resolved'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            已解决
                          </button>
                          <button
                            type="button"
                            onClick={() => navigateToBug(undefined, 'mine')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                              bugViewTab === 'mine'
                                ? 'bg-white text-sky-600 shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            我的
                          </button>
                        </div>

                        <div className="relative">
                          <input
                            value={bugSearchInput}
                            onChange={(e) => setBugSearchInput(e.target.value)}
                            placeholder="按标题模糊搜索"
                            className="w-full rounded-lg border border-gray-300 pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                          />
                          <svg className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35m1.85-5.15a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                      </div>

                      {bugsLoading && <div className="p-6 text-center text-sm text-gray-500">加载中...</div>}

                      {!bugsLoading && visibleBugs.length === 0 && (
                        <div className="p-6 text-center text-sm text-gray-500">
                          {bugSearch ? '未找到匹配的缺陷' : bugViewTab === 'mine' ? '当前没有分配给我的缺陷' : '暂无缺陷'}
                        </div>
                      )}

                      <div className="divide-y divide-gray-100">
                        {visibleBugs.map((bug) => (
                          <div
                            id={`bug-card-${bug.id}`}
                            key={bug.id}
                            onClick={() => navigateToBug(bug.id, bugViewTab === 'mine' ? 'mine' : getBugViewTabByStatus(bug.status))}
                            className={`cursor-pointer p-4 transition-colors hover:bg-gray-50 ${routeBugId === bug.id ? 'bg-red-50' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="truncate font-medium text-gray-900">{bug.title}</h3>
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${getBugSeverityStyle(bug.severity)}`}>
                                    {getBugSeverityLabel(bug.severity)}
                                  </span>
                                </div>
                                <p className="mt-2 line-clamp-2 text-xs text-gray-500">{bug.description || '暂无缺陷描述'}</p>
                                <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5">{getBugStatusLabel(bug.status)}</span>
                                  <span>{bug.assignee?.username || '未指派'}</span>
                                </div>
                              </div>
                              {canManageMembers && (
                                <div className="flex items-center gap-2">
                                  <IconActionButton
                                    icon={Pencil}
                                    label="修改"
                                    variant="red"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditBug(bug);
                                    }}
                                  />
                                  <IconActionButton
                                    icon={Trash2}
                                    label="删除"
                                    variant="red"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteBug(bug.id);
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!bugsLoading && bugTotal > 0 && (
                        <div className="flex items-center justify-between border-t border-gray-100 p-4 text-sm">
                          <span className="text-gray-500">第 {bugPage} / {bugTotalPages} 页，共 {bugTotal} 条</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setBugPage((prev) => Math.max(1, prev - 1))}
                              disabled={bugPage <= 1}
                              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
                            >
                              上一页
                            </button>
                            <button
                              type="button"
                              onClick={() => setBugPage((prev) => Math.min(bugTotalPages, prev + 1))}
                              disabled={bugPage >= bugTotalPages}
                              className="rounded border border-gray-300 px-3 py-1.5 disabled:opacity-50"
                            >
                              下一页
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="min-h-[720px]">
                      {!selectedBug ? (
                        <div className="flex min-h-[720px] items-center justify-center rounded-lg border border-gray-100 bg-white text-sm text-gray-500 shadow-sm">
                          请选择左侧缺陷查看详情
                        </div>
                      ) : (
                        <div className="min-h-[720px] rounded-lg border border-gray-100 bg-white shadow-sm flex flex-col">
                          <div className="border-b border-gray-100 px-6 py-5">
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h2 className="text-2xl font-semibold text-gray-900">{selectedBug.title}</h2>
                                  <span className={`rounded-full px-2.5 py-1 text-xs ${getBugSeverityStyle(selectedBug.severity)}`}>
                                    {getBugSeverityLabel(selectedBug.severity)} 优先级
                                  </span>
                                  <span className={`rounded-full px-2.5 py-1 text-xs ${
                                    selectedBug.status === 'closed' || selectedBug.status === 'fixed'
                                      ? 'bg-green-100 text-green-700'
                                      : selectedBug.status === 'in-progress'
                                      ? 'bg-blue-100 text-blue-700'
                                      : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    {getBugStatusLabel(selectedBug.status)}
                                  </span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                                  <span>报告人：{selectedBug.reporter?.username || `#${selectedBug.reporter_id}`}</span>
                                  <span>处理人：{selectedBug.assignee?.username || '未指派'}</span>
                                  <span>更新时间：{formatDateTime(selectedBug.updated_at)}</span>
                                </div>
                                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-wide text-gray-400">缺陷 ID</div>
                                    <div className="mt-2 text-sm font-medium text-gray-900">#{`b${selectedBug.id}`}</div>
                                  </div>
                                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-wide text-gray-400">报告人</div>
                                    <div className="mt-2 text-sm font-medium text-gray-900">{selectedBug.reporter?.username || `#${selectedBug.reporter_id}`}</div>
                                  </div>
                                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-wide text-gray-400">创建时间</div>
                                    <div className="mt-2 text-sm font-medium text-gray-900">{formatDateTime(selectedBug.created_at)}</div>
                                  </div>
                                  <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                                    <div className="text-xs uppercase tracking-wide text-gray-400">更新时间</div>
                                    <div className="mt-2 text-sm font-medium text-gray-900">{formatDateTime(selectedBug.updated_at)}</div>
                                  </div>
                                </div>
                              </div>

                              {canManageMembers && (
                                <div className="flex items-center gap-2">
                                  <IconActionButton
                                    icon={Pencil}
                                    label="修改缺陷"
                                    variant="neutral"
                                    onClick={() => handleEditBug(selectedBug)}
                                  />
                                  {!selectedBug.assignee_id && (
                                    <IconActionButton
                                      icon={UserPlus}
                                      label="指派"
                                      variant="neutral"
                                      onClick={() => {
                                        const userId = prompt('输入用户ID进行指派:');
                                        if (userId) {
                                          handleAssignBug(selectedBug.id, parseInt(userId, 10));
                                        }
                                      }}
                                    />
                                  )}
                                  <IconActionButton
                                    icon={Trash2}
                                    label="删除缺陷"
                                    variant="red"
                                    styleType="solid"
                                    onClick={() => handleDeleteBug(selectedBug.id)}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 space-y-6 px-6 py-6">
                            <section className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                              <h3 className="text-base font-semibold text-gray-900">缺陷描述</h3>
                              <p className="mt-3 text-sm leading-relaxed text-gray-600">{selectedBug.description || '暂无缺陷描述'}</p>
                            </section>

                            {parseBugImages(selectedBug.images).length > 0 && (
                              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                                <h3 className="text-base font-semibold text-gray-900">附件截图</h3>
                                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                                  {parseBugImages(selectedBug.images).map((imgSrc: string, idx: number) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => setPreviewImage(imgSrc)}
                                      className="relative group text-left"
                                    >
                                      <img
                                        src={imgSrc}
                                        alt={`附件 ${idx + 1}`}
                                        className="h-28 w-full rounded border border-gray-300 object-cover transition-transform group-hover:scale-[1.02]"
                                      />
                                      <span className="absolute inset-0 rounded bg-black/0 group-hover:bg-black/10 transition-colors" />
                                    </button>
                                  ))}
                                </div>
                              </section>
                            )}

                            {bugTimelineItems.length > 0 && (
                              <section className="rounded-2xl border border-amber-100 bg-amber-50 p-5">
                                <h3 className="text-base font-semibold text-amber-900">状态时间线</h3>
                                <div className="mt-4 space-y-4">
                                  {bugTimelineItems.map((history, index) => (
                                    <div key={history.id} className="flex gap-3">
                                      <div className="flex flex-col items-center">
                                        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-amber-500" />
                                        {index < bugTimelineItems.length - 1 && (
                                          <span className="mt-2 w-px flex-1 bg-amber-200" />
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1 rounded-xl border border-amber-200/80 bg-white/70 px-4 py-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <div className="text-sm font-semibold text-amber-950">
                                            {getBugStatusTransitionLabel(history.from_status, history.to_status)}
                                          </div>
                                          <div className="text-xs text-amber-800/70">
                                            {formatDateTime(history.created_at)}
                                          </div>
                                        </div>
                                        <div className="mt-1 text-xs text-amber-800/80">
                                          操作人：{history.changed_by_user?.username || `#${history.changed_by}`}
                                        </div>
                                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-amber-950/80">
                                          {history.note}
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </section>
                            )}

                            {canManageMembers && (
                              <section className="rounded-2xl border border-gray-100 bg-white p-5">
                                <h3 className="text-base font-semibold text-gray-900">处理操作</h3>
                                <div className="mt-4">
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    状态变更说明 <span className="text-red-500">*</span>
                                  </label>
                                  <textarea
                                    value={bugStatusNote}
                                    onChange={(e) => setBugStatusNote(e.target.value)}
                                    placeholder="请输入本次状态变更的说明，说明修复内容、关闭原因或重新打开原因..."
                                    rows={3}
                                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                  />
                                </div>
                                <div className="mt-4 flex flex-wrap gap-3">
                                  {selectedBug.status === 'open' && (
                                    <button
                                      onClick={() => handleUpdateBugStatus(selectedBug.id, 'in-progress')}
                                      disabled={!bugStatusNote.trim()}
                                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                                    >
                                      开始处理
                                    </button>
                                  )}
                                  {selectedBug.status === 'in-progress' && (
                                    <button
                                      onClick={() => handleUpdateBugStatus(selectedBug.id, 'fixed')}
                                      disabled={!bugStatusNote.trim()}
                                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                                    >
                                      标记修复
                                    </button>
                                  )}
                                  {selectedBug.status === 'fixed' && (
                                    <>
                                      <button
                                        onClick={() => handleUpdateBugStatus(selectedBug.id, 'closed')}
                                        disabled={!bugStatusNote.trim()}
                                        className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        关闭缺陷
                                      </button>
                                      <button
                                        onClick={() => handleUpdateBugStatus(selectedBug.id, 'open')}
                                        disabled={!bugStatusNote.trim()}
                                        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        重新打开
                                      </button>
                                    </>
                                  )}
                                  {selectedBug.status === 'closed' && (
                                    <button
                                      onClick={() => handleUpdateBugStatus(selectedBug.id, 'open')}
                                      disabled={!bugStatusNote.trim()}
                                      className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      重新打开
                                    </button>
                                  )}
                                </div>
                              </section>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <DocumentManagement
                    projectId={project.id}
                    canEdit={canManageMembers}
                    currentUserId={currentUser?.id}
                    members={members}
                  />
                )}

                {activeTab === 'repositories' && (
                  <RepositoryManagement
                    projectId={project.id}
                    canEdit={canManageMembers}
                  />
                )}

                {activeTab === 'prototypes' && (
                  <PrototypeManagement
                    projectId={project.id}
                    canEdit={canManageMembers}
                  />
                )}
              </div>
            </div>
          </>
        )}
      
      {/* Add Member Modal */}
      {project && (
        <AddMemberModal
          isOpen={isAddMemberModalOpen}
          onClose={() => setIsAddMemberModalOpen(false)}
          projectId={project.id}
          onSuccess={handleAddMemberSuccess}
          existingMemberIds={members.map(m => m.user_id)}
        />
      )}

      {/* Create Task Modal */}
      {project && (
        <CreateTaskModal
          isOpen={isCreateTaskModalOpen}
          onClose={() => setIsCreateTaskModalOpen(false)}
          projectId={project.id}
          onSuccess={handleTaskCreateSuccess}
        />
      )}

      {/* Edit Task Modal */}
      {project && (
        <EditTaskModal
          isOpen={isEditTaskModalOpen}
          onClose={() => setIsEditTaskModalOpen(false)}
          projectId={project.id}
          task={editingTask}
          onSuccess={handleTaskEditSuccess}
        />
      )}

      {/* Create Bug Modal */}
      {project && (
        <CreateBugModal
          isOpen={isCreateBugModalOpen}
          onClose={() => setIsCreateBugModalOpen(false)}
          projectId={project.id}
          onSuccess={handleBugCreateSuccess}
        />
      )}

      {project && (
        <EditBugModal
          isOpen={isEditBugModalOpen}
          onClose={() => {
            setIsEditBugModalOpen(false);
            setEditingBug(null);
          }}
          projectId={project.id}
          bug={editingBug}
          onSuccess={handleBugEditSuccess}
        />
      )}

      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-white text-gray-700 shadow-lg hover:bg-gray-100"
            >
              ×
            </button>
            <img
              src={previewImage}
              alt="缺陷附件预览"
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
});
