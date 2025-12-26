type Persistence = {
  setItem(key: string, value: string): Promise<void>;
  getItem(key: string): Promise<string | null>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
};

// Browser localStorage wrapper for persistence
// In production, this would be replaced with Supabase or IndexedDB
const browserStorage: Persistence = {
  async setItem(key: string, value: string): Promise<void> {
    localStorage.setItem(key, value);
  },
  async getItem(key: string): Promise<string | null> {
    return localStorage.getItem(key);
  },
  async removeItem(key: string): Promise<void> {
    localStorage.removeItem(key);
  },
  async clear(): Promise<void> {
    localStorage.clear();
  },
};

export const persistence: Persistence = browserStorage;
