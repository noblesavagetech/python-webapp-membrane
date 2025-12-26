import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { persistence } from '../../utils/persistence';
import DocumentEditor from './components/DocumentEditor';
import ChatPanel from './components/ChatPanel';
import ContextPanel from './components/ContextPanel';
import './EditorWorkspace.css';

interface DocumentState {
  content: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  type: 'writing' | 'accounting' | 'research' | 'general';
  updatedAt: string;
  wordCount: number;
  memoryCount: number;
}

type Purpose = 'writing' | 'accounting' | 'research' | 'general';
type Partner = 'critical' | 'balanced' | 'expansive';

function EditorWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<Project | null>(null);
  const [document, setDocument] = useState<DocumentState>({ content: '', updatedAt: '' });
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [purpose, setPurpose] = useState<Purpose>('writing');
  const [partner, setPartner] = useState<Partner>('balanced');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.7-sonnet');
  const [showChat, setShowChat] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [memories, setMemories] = useState<string[]>([]);
  
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      if (!user || !projectId) return;
      
      const stored = await persistence.getItem(`membrane_projects_${user.id}`);
      if (stored) {
        const projects: Project[] = JSON.parse(stored);
        const found = projects.find(p => p.id === projectId);
        if (found) {
          setProject(found);
          setPurpose(found.type);
        } else {
          navigate('/dashboard');
        }
      }
      
      const docStored = await persistence.getItem(`membrane_doc_${projectId}`);
      if (docStored) {
        setDocument(JSON.parse(docStored));
      }
      
      const memoriesStored = await persistence.getItem(`membrane_memories_${projectId}`);
      if (memoriesStored) {
        setMemories(JSON.parse(memoriesStored));
      }
    };
    
    loadProject();
  }, [user, projectId, navigate]);

  const addMemory = useCallback(async (memory: string) => {
    if (!projectId) return;
    
    const updated = [...memories, memory];
    setMemories(updated);
    await persistence.setItem(`membrane_memories_${projectId}`, JSON.stringify(updated));
    
    // Update memory count in project
    if (user) {
      const stored = await persistence.getItem(`membrane_projects_${user.id}`);
      if (stored) {
        const projects: Project[] = JSON.parse(stored);
        const idx = projects.findIndex(p => p.id === projectId);
        if (idx >= 0) {
          projects[idx].memoryCount = updated.length;
          await persistence.setItem(`membrane_projects_${user.id}`, JSON.stringify(projects));
        }
      }
    }
  }, [memories, projectId, user]);

  const saveDocument = useCallback(async (content: string) => {
    if (!projectId || !user) return;
    
    const updated: DocumentState = {
      content,
      updatedAt: new Date().toISOString(),
    };
    
    await persistence.setItem(`membrane_doc_${projectId}`, JSON.stringify(updated));
    
    // Update project metadata
    const stored = await persistence.getItem(`membrane_projects_${user.id}`);
    if (stored) {
      const projects: Project[] = JSON.parse(stored);
      const idx = projects.findIndex(p => p.id === projectId);
      if (idx >= 0) {
        projects[idx].updatedAt = updated.updatedAt;
        const wordCount = content.split(/\s+/).filter(Boolean).length;
        projects[idx].wordCount = wordCount;
        await persistence.setItem(`membrane_projects_${user.id}`, JSON.stringify(projects));
        setProject(projects[idx]);
        
        // Auto-store context for large documents (every 500 words)
        if (wordCount > 500 && wordCount % 500 < 10) {
          // Extract paragraphs/sections to store as context
          const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 50);
          const recentParagraphs = paragraphs.slice(-5); // Last 5 paragraphs
          
          for (const para of recentParagraphs) {
            try {
              await addMemory(para);
            } catch (err) {
              console.error('Failed to auto-store context:', err);
            }
          }
        }
      }
    }
    
    setDocument(updated);
  }, [projectId, user, addMemory]);
      const stored = await persistence.getItem(`membrane_projects_${user.id}`);
      if (stored) {
        const projects: Project[] = JSON.parse(stored);
        const idx = projects.findIndex(p => p.id === projectId);
        if (idx >= 0) {
          projects[idx].memoryCount = updated.length;
          await persistence.setItem(`membrane_projects_${user.id}`, JSON.stringify(projects));
        }
      }
    }
  }, [memories, projectId, user]);

  if (!project) {
    return <div className="loading-screen">Loading workspace...</div>;
  }

  return (
    <div className="editor-workspace">
      <header className="workspace-header">
        <div className="header-left">
          <Link to="/dashboard" className="back-link">
            ← Dashboard
          </Link>
          <span className="header-divider">/</span>
          <h1 className="project-title">{project.name}</h1>
        </div>
        
        <div className="header-controls">
          <div className="purpose-selector">
            <label>Purpose:</label>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value as Purpose)}>
              <option value="writing">📝 Writing</option>
              <option value="accounting">📊 Accounting</option>
              <option value="research">🔬 Research</option>
              <option value="general">📁 General</option>
            </select>
          </div>
          
          <div className="partner-selector">
            <label>Partner:</label>
            <div className="partner-toggles">
              <button 
                className={`partner-btn ${partner === 'critical' ? 'active' : ''}`}
                onClick={() => setPartner('critical')}
                title="Critical: Challenges assumptions, finds flaws"
              >
                🎯
              </button>
              <button 
                className={`partner-btn ${partner === 'balanced' ? 'active' : ''}`}
                onClick={() => setPartner('balanced')}
                title="Balanced: Weighs options thoughtfully"
              >
                ⚖️
              </button>
              <button 
                className={`partner-btn ${partner === 'expansive' ? 'active' : ''}`}
                onClick={() => setPartner('expansive')}
                title="Expansive: Explores possibilities freely"
              >
                🌟
              </button>
            </div>
          </div>
          
          <div className="panel-toggles">
            <button 
              className={`toggle-btn ${showChat ? 'active' : ''}`}
              onClick={() => setShowChat(!showChat)}
              title="Toggle Chat Panel"
            >
              💬
            </button>
            <button 
              className={`toggle-btn ${showContext ? 'active' : ''}`}
              onClick={() => setShowContext(!showContext)}
              title="Toggle Context Panel"
            >
              🧠
            </button>
          </div>
        </div>
      </header>

      <div className="workspace-content">
        <div className={`editor-panel ${showChat ? '' : 'expanded'}`}>
          <DocumentEditor
            content={document.content}
            onChange={handleContentChange}
            onSelection={handleSelection}
            purpose={purpose}
            partner={partner}
            selectedModel={selectedModel}
          />
        </div>
        
        {showChat && (
          <div className="chat-panel">
            <ChatPanel
              selectedText={selectedText}
              selectedRange={selectedRange}
              purpose={purpose}
              partner={partner}
              documentContent={document.content}
              memories={memories}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              onInsertText={handleInsertText}
              onApplySuggestion={handleApplySuggestion}
              onAddMemory={addMemory}
            />
          </div>
        )}
        
        {showContext && (
          <div className="context-panel">
            <ContextPanel
              memories={memories}
              onRemoveMemory={(idx) => {
                const updated = memories.filter((_, i) => i !== idx);
                setMemories(updated);
                if (projectId) {
                  persistence.setItem(`membrane_memories_${projectId}`, JSON.stringify(updated));
                }
              }}
            />
          </div>
        )}
      </div>

      <footer className="workspace-footer">
        <div className="footer-stats">
          <span>{project.wordCount.toLocaleString()} words</span>
          <span className="stat-divider">•</span>
          <span>{memories.length} memories</span>
          <span className="stat-divider">•</span>
          <span>Last saved: {new Date(document.updatedAt || Date.now()).toLocaleTimeString()}</span>
        </div>
        <div className="footer-hint">
          {selectedText ? (
            <span>Selection active: Use chat to transform or analyze</span>
          ) : (
            <span>Tip: Select text to enable surgical editing</span>
          )}
        </div>
      </footer>
    </div>
  );
}

export default EditorWorkspace;
