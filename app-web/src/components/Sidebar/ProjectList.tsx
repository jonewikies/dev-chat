import React from 'react';
import { observer } from 'mobx-react-lite';
import { LayoutDashboard } from 'lucide-react';

interface Project {
  id: number;
  name: string;
  description?: string | null;
  status: 'active' | 'completed' | 'on-hold';
}

interface ProjectListProps {
  projects: Project[];
  activeProjectId?: number | null;
  onProjectClick: (projectId: number) => void;
}

const ProjectList = observer(({ projects, activeProjectId, onProjectClick }: ProjectListProps) => {
  return (
    <>
      {projects.map(project => {
        const isActive = project.id === activeProjectId;
        return (
        <div 
          key={project.id}
          className={`flex items-center px-3 py-3 cursor-pointer transition-colors ${isActive ? 'bg-[#e5ebea]' : 'hover:bg-[#F5F6F6]'}`}
          onClick={() => onProjectClick(project.id)}
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mr-3 text-emerald-600">
            <LayoutDashboard className="w-6 h-6" />
          </div>
          <div className="flex-1 border-b border-[#F0F2F5] pb-3">
            <div className="flex justify-between items-center mb-1">
              <span className={`font-medium text-[17px] ${isActive ? 'text-emerald-700 font-bold' : ''}`}>{project.name}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                project.status === 'active' ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-600'
              }`}>
                {project.status}
              </span>
            </div>
            <p className="text-sm text-[#667781] truncate w-64">{project.description || 'No description'}</p>
          </div>
        </div>
      );
      })}
    </>
  );
});

export default ProjectList;
