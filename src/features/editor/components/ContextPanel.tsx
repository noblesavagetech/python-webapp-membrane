import './ContextPanel.css';

interface ContextPanelProps {
  memories: string[];
  onRemoveMemory: (index: number) => void;
}

function ContextPanel({ memories, onRemoveMemory }: ContextPanelProps) {
  return (
    <div className="context-panel-container">
      <div className="context-header">
        <h3>Semantic Memory</h3>
        <span className="memory-count">{memories.length} items</span>
      </div>
      
      <div className="context-description">
        <p>
          Insights and patterns captured from your work. These inform the context 
          of every AI interaction.
        </p>
      </div>
      
      <div className="memories-list">
        {memories.length === 0 ? (
          <div className="memories-empty">
            <div className="empty-icon">🧠</div>
            <p>No memories yet</p>
            <p className="empty-hint">
              Save insights from chat responses to build your membrane's memory.
            </p>
          </div>
        ) : (
          memories.map((memory, index) => (
            <div key={index} className="memory-item">
              <div className="memory-content">
                {memory.length > 150 ? memory.slice(0, 150) + '...' : memory}
              </div>
              <button 
                className="memory-remove"
                onClick={() => onRemoveMemory(index)}
                title="Remove from memory"
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>
      
      <div className="context-footer">
        <div className="context-info">
          <h4>How Memory Works</h4>
          <p>
            When you save insights, they're stored in your personal semantic index. 
            During future sessions, relevant memories are automatically retrieved 
            to enhance AI responses.
          </p>
        </div>
      </div>
    </div>
  );
}

export default ContextPanel;
