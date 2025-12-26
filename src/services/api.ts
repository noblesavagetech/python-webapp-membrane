// Detect deployment environment and set API URL
const getAPIBaseURL = () => {
  // Check for explicit environment variable first (Railway, Vercel, etc.)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  if (typeof window === 'undefined') return 'http://localhost:8000';
  
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  
  // GitHub Codespaces: hostname pattern is "username-repo-xxxx-3000.app.github.dev"
  if (hostname.includes('.app.github.dev') || hostname.includes('.githubpreview.dev')) {
    const newHostname = hostname.replace(/-3000\./, '-8000.');
    return `${protocol}//${newHostname}`;
  }
  
  // Railway: if deployed on Railway, backend should be on a different service
  // User needs to set VITE_API_URL in Railway environment variables
  if (hostname.includes('.railway.app') || hostname.includes('.up.railway.app')) {
    console.error('Railway deployment detected. Please set VITE_API_URL environment variable to your backend URL');
    return 'BACKEND_URL_NOT_SET'; // Will cause visible error
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

export interface User {
  id: number;
  email: string;
  name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

class APIService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('auth_token');
    if (token) {
      return {
        'Authorization': `Bearer ${token}`,
      };
    }
    return {};
  }

  private async fetchAPI(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    console.log('[Membrane] Fetching:', url);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders(),
          ...options.headers,
        },
        credentials: 'omit', // Don't send credentials for Codespaces cross-origin requests
      });

      if (!response.ok) {
        console.error('[Membrane] HTTP Error:', response.status, response.statusText);
        throw new Error(`API Error: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      console.error('[Membrane] Fetch failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async signup(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await this.fetchAPI('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    });

    const data: AuthResponse = await response.json();
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.fetchAPI('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    const data: AuthResponse = await response.json();
    localStorage.setItem('auth_token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    return data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.fetchAPI('/api/auth/me');
    const user: User = await response.json();
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  }

  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  getStoredUser(): User | null {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('auth_token');
  }

  // Project methods
  async listProjects(): Promise<Project[]> {
    const response = await this.fetchAPI('/api/projects');
    const data = await response.json();
    return data.projects;
  }

  async createProject(name: string, description?: string): Promise<Project> {
    const response = await this.fetchAPI('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, description }),
    });
    return response.json();
  }

  async getProject(projectId: number): Promise<Project> {
    const response = await this.fetchAPI(`/api/projects/${projectId}`);
    return response.json();
  }

  async updateProject(projectId: number, name?: string, description?: string): Promise<Project> {
    const response = await this.fetchAPI(`/api/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description }),
    });
    return response.json();
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.fetchAPI(`/api/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  // Document methods
  async getDocument(projectId: number): Promise<{ content: string; updated_at: string }> {
    const response = await this.fetchAPI(`/api/projects/${projectId}/document`);
    return response.json();
  }

  async updateDocument(projectId: number, content: string): Promise<{ content: string; updated_at: string }> {
    const response = await this.fetchAPI(`/api/projects/${projectId}/document`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    return response.json();
  }

  async getModels(): Promise<Model[]> {
    try {
      const response = await this.fetchAPI('/api/models');
      const data = await response.json();
      console.log('[Membrane] Models loaded:', data.models?.length || 0);
      return data.models;
    } catch (error) {
      console.error('[Membrane] Failed to load models from', API_BASE_URL, error);
      throw error;
    }
  }

  async *streamChat(params: {
    message: string;
    documentContent: string;
    selectedText?: string;
    purpose: string;
    partner: string;
    model: string;
    projectId: number;
  }): AsyncGenerator<string> {
    const response = await fetch(`${API_BASE_URL}/api/projects/${params.projectId}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify({
        message: params.message,
        document_content: params.documentContent,
        selected_text: params.selectedText,
        purpose: params.purpose,
        partner: params.partner,
        model: params.model,
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
    projectId: number;
  }): Promise<string> {
    const response = await this.fetchAPI(`/api/projects/${params.projectId}/ghost-suggest`, {
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

  async addMemory(projectId: number, content: string): Promise<void> {
    await this.fetchAPI(`/api/projects/${projectId}/memory/add`, {
      method: 'POST',
      body: JSON.stringify({
        content: content,
      }),
    });
  }

  async searchMemory(projectId: number, query: string, topK: number = 5): Promise<string[]> {
    const response = await this.fetchAPI(`/api/projects/${projectId}/memory/search`, {
      method: 'POST',
      body: JSON.stringify({
        query: query,
        top_k: topK,
      }),
    });

    const data = await response.json();
    return data.results;
  }

  async uploadFile(projectId: number, file: File, train: boolean = true): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/projects/${projectId}/upload/file?train=${train}`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload error: ${response.statusText}`);
    }

    return response.json();
  }

  async listFiles(projectId: number): Promise<any[]> {
    const response = await this.fetchAPI(`/api/projects/${projectId}/upload/list`);
    const data = await response.json();
    return data.files;
  }

  async deleteFile(projectId: number, fileId: number): Promise<void> {
    await this.fetchAPI(`/api/projects/${projectId}/upload/file/${fileId}`, {
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
