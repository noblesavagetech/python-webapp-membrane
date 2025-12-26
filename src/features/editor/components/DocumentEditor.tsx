import React, { useState, useRef, useCallback, useEffect } from 'react';
import { apiService } from '../../../services/api';
import './DocumentEditor.css';

interface DocumentEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSelection: (text: string, range: { start: number; end: number } | null) => void;
  purpose: string;
  partner: string;
  selectedModel: string;
}

interface GhostSuggestion {
  text: string;
  position: number;
}

function DocumentEditor({ content, onChange, onSelection, purpose, selectedModel, partner: _partner }: DocumentEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [ghostSuggestion, setGhostSuggestion] = useState<GhostSuggestion | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ghostTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const generateGhostSuggestion = useCallback(async (text: string, cursorPosition: number) => {
    // Call real API for ghost suggestions
    try {
      const suggestion = await apiService.getGhostSuggestion({
        text,
        cursorPosition,
        purpose,
        model: selectedModel,
      });
      
      if (suggestion && suggestion.trim()) {
        return {
          text: suggestion,
          position: cursorPosition,
        };
      }
    } catch (error) {
      console.error('Ghost suggestion error:', error);
    }
    return null;
  }, [purpose, selectedModel]);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setLocalContent(newContent);
    onChange(newContent);
    
    // Clear existing ghost suggestion
    setGhostSuggestion(null);
    
    if (ghostTimeoutRef.current) {
      clearTimeout(ghostTimeoutRef.current);
    }
    
    // Generate new ghost suggestion after debounce
    if (!isComposing) {
      ghostTimeoutRef.current = window.setTimeout(async () => {
        const cursorPos = e.target.selectionStart;
        const suggestion = await generateGhostSuggestion(newContent, cursorPos);
        if (suggestion && cursorPos === newContent.length) {
          setGhostSuggestion(suggestion);
        }
      }, 1500); // Increased debounce for API call
    }
  }, [onChange, generateGhostSuggestion, isComposing]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Accept ghost suggestion with Tab
    if (e.key === 'Tab' && ghostSuggestion) {
      e.preventDefault();
      const newContent = localContent + ghostSuggestion.text;
      setLocalContent(newContent);
      onChange(newContent);
      setGhostSuggestion(null);
      
      // Move cursor to end
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = newContent.length;
          textareaRef.current.selectionEnd = newContent.length;
        }
      }, 0);
    }
    
    // Dismiss ghost suggestion with Escape
    if (e.key === 'Escape' && ghostSuggestion) {
      setGhostSuggestion(null);
    }
  }, [ghostSuggestion, localContent, onChange]);

  const handleSelect = useCallback(() => {
    if (!textareaRef.current) return;
    
    const { selectionStart, selectionEnd, value } = textareaRef.current;
    
    if (selectionStart !== selectionEnd) {
      const selectedText = value.substring(selectionStart, selectionEnd);
      onSelection(selectedText, { start: selectionStart, end: selectionEnd });
    } else {
      onSelection('', null);
    }
  }, [onSelection]);

  const wordCount = localContent.split(/\s+/).filter(Boolean).length;
  const charCount = localContent.length;

  return (
    <div className="document-editor">
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <button className="toolbar-btn" title="Bold (Ctrl+B)">
            <strong>B</strong>
          </button>
          <button className="toolbar-btn" title="Italic (Ctrl+I)">
            <em>I</em>
          </button>
          <button className="toolbar-btn" title="Underline (Ctrl+U)">
            <u>U</u>
          </button>
        </div>
        <div className="toolbar-divider"></div>
        <div className="toolbar-group">
          <button className="toolbar-btn" title="Heading 1">
            H1
          </button>
          <button className="toolbar-btn" title="Heading 2">
            H2
          </button>
          <button className="toolbar-btn" title="List">
            ≡
          </button>
        </div>
        <div className="toolbar-spacer"></div>
        <div className="toolbar-info">
          <span>{wordCount} words</span>
          <span className="info-divider">•</span>
          <span>{charCount} chars</span>
        </div>
      </div>
      
      <div className="editor-container">
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={localContent}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder="Begin writing... The membrane will learn your patterns."
          spellCheck
        />
        
        {ghostSuggestion && (
          <div className="ghost-suggestion">
            <span className="ghost-text">{ghostSuggestion.text}</span>
            <span className="ghost-hint">Press Tab to accept</span>
          </div>
        )}
      </div>
      
      <div className="editor-hints">
        <span className="hint-item">
          <kbd>Tab</kbd> Accept suggestion
        </span>
        <span className="hint-item">
          <kbd>Esc</kbd> Dismiss
        </span>
        <span className="hint-item">
          Select text for surgical editing
        </span>
      </div>
    </div>
  );
}

export default DocumentEditor;
