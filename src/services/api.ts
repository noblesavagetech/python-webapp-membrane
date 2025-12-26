// Detect GitHub Codespaces environment
const getAPIBaseURL = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // GitHub Codespaces: hostname pattern is like "username-reponame-random.app.github.dev"
  if (hostname.includes('.app.github.dev') || hostname.includes('.githubpreview.dev')) {
    // The port is in the subdomain: change 3000 to 8000
    const newHostname = hostname.replace(/-3000\./, '-8000.');
    return `${protocol}//${newHostname}`;
  }
  
  // Local development
  return 'http://localhost:8000';
};

export const API_BASE_URL = getAPIBaseURL();
console.log('[Membrane] API_BASE_URL:', API_BASE_URL);

export interface Model {
  id: string;
  name: string;
  provider: string;
  context_length: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

class APIService {
  private async fetchAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[Membrane] Fetching:', url);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'omit', // Don't send credentials for Codespaces cross-origin requests
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response;
  }

  async getModels(): Promise<Model[]> {
    const response = await this.fetchAPI('/api/models');
    const data = await response.json();
    return data.models;
  }

  async *streamChat(params: {
    message: string;
    documentContent: string;
    selectedText?: string;
    purpose: string;
    partner: string;
    model: string;
    projectId: string;
  }): AsyncGenerator<string> {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: params.message,
        document_content: params.documentContent,
        selected_text: params.selectedText,
        purpose: params.purpose,
        partner: params.partner,
        model: params.model,
        project_id: params.projectId,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stream error: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No reader available');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              yield parsed.content;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }
  }

  async getGhostSuggestion(params: {
    text: string;
    cursorPosition: number;
    purpose: string;
    model: string;
  }): Promise<string> {
    const response = await this.fetchAPI('/api/ghost-suggest', {
      method: 'POST',
      body: JSON.stringify({
        text: params.text,
        cursor_position: params.cursorPosition,
        purpose: params.purpose,
        model: params.model,
      }),
    });

    const data = await response.json();
    return data.suggestion;
  }

  async addMemory(projectId: string, content: string): Promise<void> {
    await this.fetchAPI('/api/memory/add', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        content: content,
      }),
    });
  }

  async searchMemory(projectId: string, query: string, topK: number = 5): Promise<string[]> {
    const response = await this.fetchAPI('/api/memory/search', {
      method: 'POST',
      body: JSON.stringify({
        project_id: projectId,
        query: query,
        top_k: topK,
      }),
    });

    const data = await response.json();
    return data.results;
  }

  async uploadFile(projectId: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/upload/file?project_id=${projectId}`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload error: ${response.statusText}`);
    }

    return response.json();
  }

  async listFiles(projectId: string): Promise<any[]> {
    const response = await this.fetchAPI(`/api/upload/list/${projectId}`);
    const data = await response.json();
    return data.files;
  }

  async deleteFile(projectId: string, filename: string): Promise<void> {
    await this.fetchAPI(`/api/upload/file/${projectId}/${filename}`, {
      method: 'DELETE',
    });
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.fetchAPI('/health');
      const data = await response.json();
      return data.status === 'healthy';
    } catch {
      return false;
    }
  }
}

export const apiService = new APIService();
