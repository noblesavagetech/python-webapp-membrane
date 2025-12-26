import React, { useState, useRef, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { apiService, Model, API_BASE_URL } from '../../../services/api';
import './ChatPanel.css';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type?: 'suggestion' | 'analysis' | 'memory';
  suggestion?: {
    original: string;
    proposed: string;
  };
}

interface ChatPanelProps {
  selectedText: string;
  selectedRange: { start: number; end: number } | null;
  purpose: string;
  partner: string;
  documentContent: string;
  memories: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  onInsertText: (text: string) => void;
  onApplySuggestion: (original: string, suggestion: string) => void;
  onAddMemory: (memory: string) => void;
  projectId: number | null;
}

const QUICK_ACTIONS = [
  { label: 'Improve', command: '/improve' },
  { label: 'Expand', command: '/expand' },
  { label: 'Simplify', command: '/simplify' },
  { label: 'Challenge', command: '/challenge' },
];

function ChatPanel({
  selectedText,
  purpose,
  partner,
  documentContent,
  selectedModel,
  onModelChange,
  onApplySuggestion,
  onAddMemory,
  projectId,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Load available models
    apiService.getModels()
      .then(data => {
        console.log('Loaded models:', data);
        setModels(data);
      })
      .catch(err => {
        console.error('Failed to load models:', err);
      });
  }, []);

  const sendMessage = async (messageText?: string) => {
    const text = messageText || input.trim();
    if (!text || !projectId) return;
    
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsThinking(true);
    
    try {
      let assistantContent = '';
      const assistantId = crypto.randomUUID();
      
      // Add placeholder message for streaming
      setMessages(prev => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      }]);
      
      // Smart context handling: if document is large, use last 2000 words + selected text
      const words = documentContent.split(/\\s+/);
      const contextContent = words.length > 2000 
        ? words.slice(-2000).join(' ')  // Last 2000 words
        : documentContent;
      
      // Stream response from API
      for await (const chunk of apiService.streamChat({
        message: text,
        documentContent: contextContent,
        selectedText,
        purpose,
        partner,
        model: selectedModel,
        projectId,
      })) {
        assistantContent += chunk;
        setMessages(prev => prev.map(msg => 
          msg.id === assistantId 
            ? { ...msg, content: assistantContent }
            : msg
        ));
      }
      
      setIsThinking(false);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => prev.slice(0, -1)); // Remove placeholder
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Sorry, I encountered an error connecting to the backend at ${API_BASE_URL}. Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      }]);
      setIsThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAcceptSuggestion = (suggestion: Message['suggestion']) => {
    if (suggestion) {
      onApplySuggestion(suggestion.original, suggestion.proposed);
    }
  };

  const handleSaveAsMemory = async (content: string) => {
    if (projectId) {
      try {
        await apiService.addMemory(projectId, content);
        onAddMemory(content);
      } catch (error) {
        console.error('Error saving memory:', error);
      }
    }
  };

  return (
    <div className="chat-panel-container">
      <div className="chat-header">
        <h3>Context Assistant</h3>
        <div className="header-controls">
          {selectedText && (
            <div className="selection-indicator">
              <span className="indicator-dot"></span>
              Selection active
            </div>
          )}
          <button 
            className="model-selector-btn"
            onClick={() => {
              console.log('Toggle dropdown, current:', showModelSelector, 'models:', models);
              setShowModelSelector(!showModelSelector);
            }}
            title="Change AI model"
          >
            🤖 {models.find(m => m.id === selectedModel)?.name.split(' ')[0] || 'Model'}
          </button>
        </div>
      </div>

      {showModelSelector && (
        <div className="model-selector">
          {models.map(model => (
            <button
              key={model.id}
              className={`model-option ${selectedModel === model.id ? 'active' : ''}`}
              onClick={() => {
                onModelChange(model.id);
                setShowModelSelector(false);
              }}
            >
              <div className="model-name">{model.name}</div>
              <div className="model-provider">{model.provider}</div>
            </button>
          ))}
        </div>
      )}
      
      {selectedText && (
        <div className="quick-actions">
          {QUICK_ACTIONS.map(action => (
            <button
              key={action.command}
              className="quick-action-btn"
              onClick={() => sendMessage(action.command)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="empty-icon">💭</div>
            <p>Start a conversation with your AI thinking partner.</p>
            <p className="empty-hint">
              Using: {models.find(m => m.id === selectedModel)?.name || 'Claude 3.5 Sonnet'}
            </p>
          </div>
        )}
        
        {messages.map(message => (
          <div key={message.id} className={`message message-${message.role}`}>
            <div className="message-content">
              {message.content}
              
              {message.suggestion && (
                <div className="suggestion-diff">
                  <div className="diff-section diff-original">
                    <span className="diff-label">Original</span>
                    <p className="diff-text strikethrough">{message.suggestion.original}</p>
                  </div>
                  <div className="diff-section diff-proposed">
                    <span className="diff-label">Suggested</span>
                    <p className="diff-text">{message.suggestion.proposed}</p>
                  </div>
                  <div className="diff-actions">
                    <button 
                      className="diff-btn accept"
                      onClick={() => handleAcceptSuggestion(message.suggestion)}
                    >
                      ✓ Accept
                    </button>
                    <button className="diff-btn reject">
                      ✗ Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            {message.role === 'assistant' && !message.suggestion && message.content && (
              <button 
                className="save-memory-btn"
                onClick={() => handleSaveAsMemory(message.content)}
                title="Save to memory"
              >
                🧠
              </button>
            )}
          </div>
        ))}
        
        {isThinking && (
          <div className="message message-assistant">
            <div className="thinking-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="chat-input-container">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question or use /commands..."
          rows={2}
        />
        <button 
          className="send-btn"
          onClick={() => sendMessage()}
          disabled={!input.trim() || isThinking}
        >
          →
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
