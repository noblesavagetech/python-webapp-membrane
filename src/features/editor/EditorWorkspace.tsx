import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiService, Project as APIProject } from '../../services/api';
import DocumentEditor from './components/DocumentEditor';
import ChatPanel from './components/ChatPanel';
import ContextPanel from './components/ContextPanel';
import './EditorWorkspace.css';

interface DocumentState {
  content: string;
  updatedAt: string;
}

type Purpose = 'writing' | 'accounting' | 'research' | 'general';
type Partner = 'critical' | 'balanced' | 'expansive';

function EditorWorkspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [project, setProject] = useState<APIProject | null>(null);
  const [document, setDocument] = useState<DocumentState>({ content: '', updatedAt: '' });
  const [selectedText, setSelectedText] = useState('');
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [purpose, setPurpose] = useState<Purpose>('writing');
  const [partner, setPartner] = useState<Partner>('balanced');
  const [selectedModel, setSelectedModel] = useState('anthropic/claude-3.7-sonnet');
  const [showChat, setShowChat] = useState(true);
  const [showContext, setShowContext] = useState(false);
  const [memories, setMemories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  const saveTimeoutRef = useRef<number | null>(null);
  const projectIdNum = projectId ? parseInt(projectId, 10) : null;

  useEffect(() => {
    const loadProject = async () => {
      if (!user || !projectIdNum) {
        navigate('/dashboard');
        return;
      }
      
      try {
        const projectData = await apiService.getProject(projectIdNum);
        setProject(projectData);
        
        const docData = await apiService.getDocument(projectIdNum);
        setDocument({
          content: docData.content,
          updatedAt: docData.updated_at,
        });
      } catch (error) {
        console.error('Failed to load project:', error);
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    };
    
    loadProject();
  }, [user, projectIdNum, navigate]);

  const saveDocument = useCallback(async (content: string) => {
    if (!projectIdNum || !user) return;
    
    const updated: DocumentState = {
      content,
      updatedAt: new Date().toISOString(),
    };
    
    setDocument(updated);
    
    // Save to backend with debounce handled by handleContentChange
    try {
      await apiService.updateDocument(projectIdNum, content);
    } catch (error) {
      console.error('Failed to save document:', error);
    }
  }, [projectIdNum, user]);

  const handleContentChange = useCallback((content: string) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = window.setTimeout(() => {
      saveDocument(content);
    }, 1000);
  }, [saveDocument]);

  const handleSelection = useCallback((text: string, range: { start: number; end: number } | null) => {
    setSelectedText(text);
    setSelectedRange(range);
  }, []);

  const handleInsertText = useCallback((text: string) => {
    // This would be handled by the editor component
    console.log('Insert text:', text);
  }, []);

  const handleApplySuggestion = useCallback((original: string, suggestion: string) => {
    // This would trigger the non-destructive diff in the editor
    console.log('Apply suggestion:', { original, suggestion });
  }, []);

  const addMemory = useCallback(async (memory: string) => {
    if (!projectIdNum) return;
    
    try {
      await apiService.addMemory(projectIdNum, memory);
      const updated = [...memories, memory];
      setMemories(updated);
    } catch (error) {
      console.error('Failed to add memory:', error);
    }
  }, [memories, projectIdNum]);

  if (loading) {
    return <div className="loading-screen">Loading workspace...</div>;
  }

  if (!project) {
    return <div className="loading-screen">Project not found...</div>;
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
            projectId={projectIdNum}
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
              projectId={projectIdNum}
            />
          </div>
        )}
        
        {showContext && (
          <div className="context-panel">
            <ContextPanel
              memories={memories}
              projectId={projectIdNum}
              onRemoveMemory={async (idx) => {
                const updated = memories.filter((_, i) => i !== idx);
                setMemories(updated);
                // TODO: Implement remove memory endpoint
              }}
            />
          </div>
        )}
      </div>

      <footer className="workspace-footer">
        <div className="footer-stats">
          <span>{document.content.split(/\s+/).filter(Boolean).length} words</span>
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
