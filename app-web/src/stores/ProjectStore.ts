import { types, flow, Instance } from 'mobx-state-tree';
import { projectApi, ApiProject } from '../api';

export const Project = types.model('Project', {
  id: types.identifierNumber,
  name: types.string,
  description: types.maybeNull(types.string),
  goal: types.maybeNull(types.string),
  content: types.maybeNull(types.string),
  milestone: types.maybeNull(types.string),
  timeline: types.maybeNull(types.string),
  status: types.optional(types.enumeration(['active', 'completed', 'on-hold']), 'active'),
  ownerId: types.number,
  createdAt: types.Date,
  updatedAt: types.Date,
});

export const ProjectStore = types
  .model('ProjectStore', {
    projects: types.map(Project),
    activeProject: types.maybeNull(types.reference(Project)),
    isLoading: types.optional(types.boolean, false),
    error: types.maybeNull(types.string),
  })
  .actions((self) => ({
    addProject(project: ApiProject) {
      self.projects.set(project.id.toString(), {
        id: project.id,
        name: project.name,
        description: project.description || null,
        goal: project.goal || null,
        content: project.content || null,
        timeline: project.timeline || null,
        milestone: project.milestone || null,
        status: project.status,
        ownerId: project.owner_id,
        createdAt: new Date(project.created_at),
        updatedAt: new Date(project.updated_at),
      });
    },

    addProjects(projects: ApiProject[]) {
      projects.forEach((project) => this.addProject(project));
    },

    setActiveProject(projectId: number | null) {
      if (projectId === null) {
        self.activeProject = null;
      } else {
        self.activeProject = projectId as any;
      }
    },

    removeProject(projectId: number) {
      self.projects.delete(projectId.toString());
      if (self.activeProject?.id === projectId) {
        self.activeProject = null;
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
    fetchProjects: flow(function* (page = 1) {
      self.setLoading(true);
      self.setError(null);
      try {
        const response: ApiProject[] = yield projectApi.getProjects({ page });
        self.addProjects(response);
        return { projects: response, total: response.length };
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    fetchProjectDetail: flow(function* (projectId: number) {
      self.setLoading(true);
      self.setError(null);
      try {
        const project: ApiProject = yield projectApi.getProjectDetail(projectId);
        self.addProject(project);
        return project;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    createProject: flow(function* (data: {
      name: string;
      description?: string;
      goal?: string;
      content?: string;
      timeline?: string;
      milestone?: string;
      ownerId?: number;
    }) {
      self.setLoading(true);
      self.setError(null);
      try {
        const project: ApiProject = yield projectApi.createProject(data);
        self.addProject(project);
        return project;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    updateProject: flow(function* (projectId: number, updates: Partial<ApiProject>) {
      self.setLoading(true);
      self.setError(null);
      try {
        const project: ApiProject = yield projectApi.updateProject(projectId, updates);
        self.addProject(project);
        return project;
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),

    deleteProject: flow(function* (projectId: number) {
      self.setLoading(true);
      self.setError(null);
      try {
        yield projectApi.deleteProject(projectId);
        self.removeProject(projectId);
      } catch (error: any) {
        self.setError(error.message);
        throw error;
      } finally {
        self.setLoading(false);
      }
    }),
  }))
  .views((self) => ({
    get allProjects() {
      return Array.from(self.projects.values()).sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
    },

    getProjectById(id: number) {
      return self.projects.get(id.toString());
    },

    get activeProjects() {
      return Array.from(self.projects.values()).filter((p) => p.status === 'active');
    },
  }));

export interface IProject extends Instance<typeof Project> {}
export interface IProjectStore extends Instance<typeof ProjectStore> {}
