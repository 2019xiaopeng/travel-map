/// <reference types="vite/client" />

interface Window {
  travelMap: {
    isDev: boolean;
    db: {
      query: (sql: string, params?: any[]) => Promise<any>;
      get: (sql: string, params?: any[]) => Promise<any>;
      run: (sql: string, params?: any[]) => Promise<any>;
    };
  };
}
