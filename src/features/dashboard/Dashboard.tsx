import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { persistence } from '../../utils/persistence';
import './Dashboard.css';

interface Project {
  id: string;
  name: string;
  type: 'writing' | 'accounting' | 'research' | 'general';
  updatedAt: string;
  wordCount: number;
  memoryCount: number;
}

const PROJECT_TYPES = {
  writing: { icon: '📝', label: 'Writing' },
  accounting: { icon: '📊', label: 'Accounting' },
  research: { icon: '🔬', label: 'Research' },
  general: { icon: '📁', label: 'General' },
};

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectType, setNewProjectType] = useState<Project['type']>('writing');

  useEffect(() => {
    const loadProjects = async () => {
      if (!user) return;
      const stored = await persistence.getItem(`membrane_projects_${user.id}`);
      if (stored) {
        setProjects(JSON.parse(stored));
      }
    };
    loadProjects();
  }, [user]);

  const saveProjects = async (updated: Project[]) => {
    if (!user) return;
    await persistence.setItem(`membrane_projects_${user.id}`, JSON.stringify(updated));
    setProjects(updated);
  };

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    
    const newProject: Project = {
      id: crypto.randomUUID(),
      name: newProjectName,
      type: newProjectType,
      updatedAt: new Date().toISOString(),
      wordCount: 0,
      memoryCount: 0,
    };
    
    await saveProjects([newProject, ...projects]);
    setNewProjectName('');
    setNewProjectType('writing');
    setShowNewProject(false);
    navigate(`/workspace/${newProject.id}`);
  };

  const deleteProject = async (id: string) => {
    if (confirm('Delete this project? This cannot be undone.')) {
      await saveProjects(projects.filter(p => p.id !== id));
      await persistence.removeItem(`membrane_doc_${id}`);
    }
  };

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <span className="header-logo">◈</span>
          <h1>Your Membrane</h1>
        </div>
        <div className="header-right">
          <span className="user-name">{user?.name}</span>
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="dashboard-focus">
          <h2>Current Focus</h2>
          {projects.length > 0 ? (
            <Link to={`/workspace/${projects[0].id}`} className="focus-card">
              <div className="focus-icon">{PROJECT_TYPES[projects[0].type].icon}</div>
              <div className="focus-info">
                <h3>{projects[0].name}</h3>
                <p>Last edited {formatDate(projects[0].updatedAt)}</p>
              </div>
              <div className="focus-stats">
                <span>{projects[0].wordCount.toLocaleString()} words</span>
                <span>{projects[0].memoryCount} memories</span>
              </div>
              <span className="focus-arrow">→</span>
            </Link>
          ) : (
            <div className="focus-empty">
              <p>No active projects. Create one to begin.</p>
            </div>
          )}
        </section>

        <section className="dashboard-projects">
          <div className="projects-header">
            <h2>All Projects</h2>
            <button 
              className="new-project-btn"
              onClick={() => setShowNewProject(true)}
            >
              + New Project
            </button>
          </div>

          {showNewProject && (
            <div className="new-project-form">
              <input
                type="text"
                placeholder="Project name..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                autoFocus
              />
              <div className="type-selector">
                {Object.entries(PROJECT_TYPES).map(([type, { icon, label }]) => (
                  <button
                    key={type}
                    className={`type-btn ${newProjectType === type ? 'active' : ''}`}
                    onClick={() => setNewProjectType(type as Project['type'])}
                  >
                    {icon} {label}
                  </button>
                ))}
              </div>
              <div className="form-actions">
                <button className="cancel-btn" onClick={() => setShowNewProject(false)}>
                  Cancel
                </button>
                <button className="create-btn" onClick={createProject}>
                  Create
                </button>
              </div>
            </div>
          )}

          <div className="projects-grid">
            {projects.map(project => (
              <div key={project.id} className="project-card">
                <Link to={`/workspace/${project.id}`} className="project-link">
                  <div className="project-icon">{PROJECT_TYPES[project.type].icon}</div>
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <p>{formatDate(project.updatedAt)}</p>
                  </div>
                  <div className="project-meta">
                    <span>{project.wordCount.toLocaleString()} words</span>
                  </div>
                </Link>
                <button 
                  className="project-delete"
                  onClick={(e) => {
                    e.preventDefault();
                    deleteProject(project.id);
                  }}
                  title="Delete project"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {projects.length === 0 && !showNewProject && (
            <div className="projects-empty">
              <div className="empty-icon">◈</div>
              <h3>Begin Your Membrane</h3>
              <p>Create your first project to start capturing and amplifying your thoughts.</p>
              <button 
                className="empty-cta"
                onClick={() => setShowNewProject(true)}
              >
                Create First Project
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
