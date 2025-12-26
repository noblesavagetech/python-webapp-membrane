import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiService, Project as APIProject } from '../../services/api';
import './Dashboard.css';

interface Project extends APIProject {
  wordCount?: number;
  memoryCount?: number;
}

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const projectList = await apiService.listProjects();
        setProjects(projectList);
      } catch (error) {
        console.error('Failed to load projects:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (user) {
      loadProjects();
    }
  }, [user]);

  const createProject = async () => {
    if (!newProjectName.trim()) return;
    
    try {
      const newProject = await apiService.createProject(newProjectName, newProjectDescription);
      setProjects([newProject, ...projects]);
      setNewProjectName('');
      setNewProjectDescription('');
      setShowNewProject(false);
      navigate(`/workspace/${newProject.id}`);
    } catch (error) {
      console.error('Failed to create project:', error);
      alert('Failed to create project');
    }
  };

  const deleteProject = async (id: number) => {
    if (confirm('Delete this project? This cannot be undone.')) {
      try {
        await apiService.deleteProject(id);
        setProjects(projects.filter(p => p.id !== id));
      } catch (error) {
        console.error('Failed to delete project:', error);
        alert('Failed to delete project');
      }
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

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading your projects...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <span className="header-logo">◈</span>
          <h1>Your Membrane</h1>
        </div>
        <div className="header-right">
          <span className="user-name">{user?.name || user?.email}</span>
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
              <div className="focus-icon">📝</div>
              <div className="focus-info">
                <h3>{projects[0].name}</h3>
                <p>Last edited {formatDate(projects[0].updated_at)}</p>
              </div>
              <div className="focus-stats">
                <span>{projects[0].wordCount || 0} words</span>
                <span>{projects[0].memoryCount || 0} memories</span>
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
              <input
                type="text"
                placeholder="Description (optional)..."
                value={newProjectDescription}
                onChange={(e) => setNewProjectDescription(e.target.value)}
              />
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
                  <div className="project-icon">📝</div>
                  <div className="project-info">
                    <h3>{project.name}</h3>
                    <p>{project.description || formatDate(project.updated_at)}</p>
                  </div>
                  <div className="project-meta">
                    <span>{project.wordCount || 0} words</span>
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
