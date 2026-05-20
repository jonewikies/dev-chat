import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/api.types';
import { ForbiddenError, NotFoundError } from '../utils/error.util';
import { ProjectMemberRepository } from '../repositories/project-member.repository';
import { ProjectRepository } from '../repositories/project.repository';

export const requireProjectPermission = (minRole: 'owner' | 'member' | 'viewer') => {
  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const userId = req.user!.id;

      // 首先检查项目是否存在
      const projectRepo = new ProjectRepository();
      const project = await projectRepo.findById(projectId);
      if (!project) {
        throw new NotFoundError('项目不存在');
      }

      // 然后检查用户权限
      const projectMemberRepo = new ProjectMemberRepository();
      const member = await projectMemberRepo.findByProjectAndUser(projectId, userId);

      if (!member) {
        throw new ForbiddenError('您不是该项目成员');
      }

      const roleHierarchy: Record<string, number> = {
        viewer: 1,
        member: 2,
        owner: 3,
      };

      if (roleHierarchy[member.role] < roleHierarchy[minRole]) {
        throw new ForbiddenError('权限不足');
      }

      req.projectMember = {
        id: member.id,
        role: member.role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

export const requireChatMember = async (
  _req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  try {
    // TODO: Implement ChatMemberRepository check
    // For now, allow all
    next();
  } catch (error) {
    next(error);
  }
};
