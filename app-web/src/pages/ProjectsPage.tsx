import { useEffect, useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from '../hooks/useProjectStore';
import { useLanguage } from '../i18n';
import { formatDateTime } from '../utils/date-time';

export default observer(function ProjectsPage() {
  const projectStore = useProjectStore();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'on-hold' | 'completed'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const statusOptions: Array<'all' | 'active' | 'on-hold' | 'completed'> = ['all', 'active', 'on-hold', 'completed'];

  useEffect(() => {
    projectStore.fetchProjects();
  }, [projectStore]);

  const filteredProjects = useMemo(() => {
    return projectStore.allProjects.filter((project) => {
      const normalizedQuery = query.trim().toLowerCase();
      const searchableText = [
        project.name,
        project.description,
        project.goal,
        project.content,
        project.timeline,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery);

      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [projectStore.allProjects, query, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter]);

  const formatDate = (date?: Date) => {
    return formatDateTime(date);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'all':
        return t('all');
      case 'active':
        return t('active');
      case 'on-hold':
        return t('onHold');
      case 'completed':
        return t('completed');
      default:
        return status;
    }
  };

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / pageSize));
  const paginatedProjects = filteredProjects.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="projects-page min-h-screen flex-1 min-w-0 overflow-y-auto">
      <div className="projects-shell">
        <header className="projects-hero">
          <div>
            <p className="projects-kicker">{t('studio')}</p>
            <h1 className="projects-title">{t('projects')}</h1>
            <p className="projects-subtitle">{t('projectWorkspaceSubtitle')}</p>
          </div>
          <div className="projects-hero-badge">
            <span className="projects-dot" />
            {projectStore.allProjects.length} {t('activeWorkstreams')}
          </div>
        </header>

        <section className="projects-panel projects-list-only">
          <div className="projects-panel-header">
            <div>
              <h2>{t('projectIndex')}</h2>
              <p>{t('curatedInitiatives')}</p>
            </div>
            <span className="projects-count">{filteredProjects.length}</span>
          </div>

          <div className="projects-filters projects-filters-wide">
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('searchProjects')}
              className="projects-input"
            />
            <div className="projects-tabs">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status as typeof statusFilter)}
                  className={`projects-tab ${statusFilter === status ? 'is-active' : ''}`}
                >
                  {getStatusLabel(status)}
                </button>
              ))}
            </div>
          </div>

          <div className="projects-list-content">
            {projectStore.isLoading && (
              <div className="projects-empty">{t('loadingProjects')}</div>
            )}

            {!projectStore.isLoading && projectStore.error && (
              <div className="projects-empty">{projectStore.error}</div>
            )}

            {!projectStore.isLoading && !projectStore.error && filteredProjects.length === 0 && (
              <div className="projects-empty">{t('noMatchingProjects')}</div>
            )}

            {!projectStore.isLoading && !projectStore.error && paginatedProjects.length > 0 && (
              <>
                <div className="projects-card-grid">
                  {paginatedProjects.map((project) => (
                    <article 
                      key={project.id} 
                      className="projects-card projects-card-grid-item"
                      onClick={() => navigate(`/project/${project.id}/overview`)}
                    >
                      <div className="projects-card-header">
                        <h3>{project.name}</h3>
                        <span className={`projects-status is-${project.status}`}>{getStatusLabel(project.status)}</span>
                      </div>
                      <p>{project.description || t('noProjectDescription')}</p>
                      <div className="projects-card-section">
                        <span className="projects-card-label">{t('projectGoal')}</span>
                        <strong>{project.goal || t('noProjectObjective')}</strong>
                      </div>
                      <div className="projects-card-section">
                        <span className="projects-card-label">{t('timeline')}</span>
                        <strong>{project.timeline || '—'}</strong>
                      </div>
                      <div className="projects-card-meta">
                        <span>{t('updated')} {formatDate(project.updatedAt)}</span>
                        <span>{t('owner')} #{project.ownerId}</span>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="projects-pagination">
                  <span className="projects-pagination-text">第 {page} / {totalPages} 页，共 {filteredProjects.length} 个项目</span>
                  <div className="projects-pagination-actions">
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      className="projects-pagination-button"
                    >
                      上一页
                    </button>
                    <button
                      type="button"
                      onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      className="projects-pagination-button"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
});
