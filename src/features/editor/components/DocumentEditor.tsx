import React, { useState, useRef, useCallback, useEffect } from 'react';
import './DocumentEditor.css';

interface DocumentEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSelection: (text: string, range: { start: number; end: number } | null) => void;
  purpose: string;
  partner: string;
}

interface GhostSuggestion {
  text: string;
  position: number;
}

function DocumentEditor({ content, onChange, onSelection, purpose, partner: _partner }: DocumentEditorProps) {
  const [localContent, setLocalContent] = useState(content);
  const [ghostSuggestion, setGhostSuggestion] = useState<GhostSuggestion | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const ghostTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const generateGhostSuggestion = useCallback((text: string, cursorPosition: number) => {
    // Simulated ghost-writing suggestions based on context
    const lastSentence = text.slice(0, cursorPosition).split(/[.!?]\s*/).pop() || '';
    const words = lastSentence.trim().split(/\s+/);
    
    if (words.length < 3) return null;
    
    const suggestions: Record<string, string[]> = {
      writing: [
        ' and this leads to an interesting observation.',
        ' which suggests a deeper pattern.',
        ' revealing the underlying structure.',
        ', expanding on this concept further.',
      ],
      accounting: [
        ' resulting in a net adjustment of',
        ' which affects the quarterly projection.',
        ' per the standard reconciliation process.',
        ', subject to audit verification.',
      ],
      research: [
        ' as demonstrated in the literature.',
        ' warranting further investigation.',
        ' consistent with our hypothesis.',
        ', requiring additional data points.',
      ],
      general: [
        ' and furthermore,',
        ' in addition to this,',
        ' considering the context,',
        ' moving forward,',
      ],
    };
    
    const purposeSuggestions = suggestions[purpose] || suggestions.general;
    const randomSuggestion = purposeSuggestions[Math.floor(Math.random() * purposeSuggestions.length)];
    
    return {
      text: randomSuggestion,
      position: cursorPosition,
    };
  }, [purpose]);

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
      ghostTimeoutRef.current = window.setTimeout(() => {
        const cursorPos = e.target.selectionStart;
        const suggestion = generateGhostSuggestion(newContent, cursorPos);
        if (suggestion && cursorPos === newContent.length) {
          setGhostSuggestion(suggestion);
        }
      }, 500);
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
