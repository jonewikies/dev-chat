import { types, flow, Instance } from 'mobx-state-tree';
import { taskApi, ApiTask } from '../api';

export const Task = types.model('Task', {
  id: types.identifierNumber,
  title: types.string,
  description: types.maybeNull(types.string),
  status: types.optional(types.enumeration(['todo', 'in-progress', 'done']), 'todo'),
  priority: types.optional(types.enumeration(['low', 'medium', 'high']), 'medium'),
  projectId: types.number,
  assigneeId: types.maybeNull(types.number),
  createdAt: types.Date,
  updatedAt: types.Date,
});

export const TaskStore = types
  .model('TaskStore', {
    tasks: types.map(Task),
    tasksByProjectId: types.map(types.array(types.reference(Task))),
    isLoading: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
  })
  .actions((self) => ({
    addTask(task: ApiTask) {
      const taskData = {
        id: task.id,
        title: task.title,
        description: task.description || null,
        status: task.status,
        priority: task.priority,
        projectId: task.project_id,
        assigneeId: task.assignee_id || null,
        createdAt: new Date(task.created_at),
        updatedAt: new Date(task.updated_at),
      };
      self.tasks.set(task.id.toString(), taskData);

      const projectId = task.project_id.toString();
      if (!self.tasksByProjectId.has(projectId)) {
        self.tasksByProjectId.set(projectId, [] as any);
      }
      const projectTasks = self.tasksByProjectId.get(projectId)!;
      if (!projectTasks.find((t) => t.id === task.id)) {
        projectTasks.push(task.id as any);
      }
    },

    addTasks(tasks: ApiTask[]) {
      tasks.forEach((task) => this.addTask(task));
    },

    removeTask(taskId: number) {
      const task = self.tasks.get(taskId.toString());
      if (task) {
        const projectId = task.projectId.toString();
        const projectTasks = self.tasksByProjectId.get(projectId);
        if (projectTasks) {
          const index = projectTasks.findIndex((t) => t.id === taskId);
          if (index !== -1) {
            projectTasks.splice(index, 1);
          }
        }
        self.tasks.delete(taskId.toString());
      }
    },

    setLoading(loading: boolean) {
      self.isLoading = loading;
    },

    setError(error: string | null) {
      self.error = error;
    },
  }))
  .actions((self) => ({
    fetchTasks: flow(function* (projectId: number) {
      self.setLoading(true);
      self.setError(null);
      try {
        const response: { items: ApiTask[] } = yield taskApi.getTasks(projectId);
        const tasks = response.items || [];
        self.addTasks(tasks);
        return tasks;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    createTask: flow(function* (projectId: number, data: {
      title: string;
      description?: string;
      assignee_id?: number;
      priority?: 'low' | 'medium' | 'high';
      status?: 'todo' | 'in-progress' | 'done';
    }) {
      self.setLoading(true);
      self.setError(null);
      try {
        const task: ApiTask = yield taskApi.createTask(projectId, data);
        self.addTask(task);
        return task;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    updateTask: flow(function* (projectId: number, taskId: number, updates: Partial<ApiTask>) {
      self.setLoading(true);
      self.setError(null);
      try {
        const task: ApiTask = yield taskApi.updateTask(projectId, taskId, updates);
        self.addTask(task);
        return task;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    deleteTask: flow(function* (projectId: number, taskId: number) {
      self.setLoading(true);
      self.setError(null);
      try {
        yield taskApi.deleteTask(projectId, taskId);
        self.removeTask(taskId);
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),
  }))
  .views((self) => ({
    getTasksByProjectId(projectId: number) {
      return self.tasksByProjectId.get(projectId.toString()) || [];
    },

    getTaskById(id: number) {
      return self.tasks.get(id.toString());
    },

    getTasksByStatus(projectId: number, status: 'todo' | 'in-progress' | 'done') {
      const tasks = this.getTasksByProjectId(projectId);
      return tasks.filter((t) => t.status === status);
    },
  }));

export interface ITask extends Instance<typeof Task> {}
export interface ITaskStore extends Instance<typeof TaskStore> {}
