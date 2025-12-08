// API Configuration for Local Development vs Production
// In development: React calls Python API directly
// In production: React calls Edge Functions which proxy to Python API

export const API_CONFIG = {
  // Automatically use direct API in development mode
  USE_DIRECT_API: import.meta.env.DEV,
  
  // Local Python API URL - change this if your Flask runs on a different port
  LOCAL_API_URL: 'http://localhost:5000',
  
  // API endpoints matching the Flask backend
  ENDPOINTS: {
    // Dataset & Training
    SYNC_DATASET: '/api/sync/dataset',
    EXTRACT_EMBEDDINGS: '/api/train/embeddings',
    TRAIN_MODEL: '/api/train/model',
    TRAINING_STATUS: '/api/train/status',
    
    // Recognition
    RECOGNIZE_IMAGE: '/api/recognize/image',
    RECOGNIZE_FRAME: '/api/recognize/frame',
    
    // Attendance
    MARK_ATTENDANCE: '/api/attendance/mark',
    
    // Health
    HEALTH: '/health',
  },
} as const;

// Helper to get full API URL
export const getApiUrl = (endpoint: string): string => {
  if (API_CONFIG.USE_DIRECT_API) {
    return `${API_CONFIG.LOCAL_API_URL}${endpoint}`;
  }
  // In production, edge functions handle the routing
  return endpoint;
};

// Check if we're using direct API mode
export const isDirectApiMode = (): boolean => API_CONFIG.USE_DIRECT_API;
