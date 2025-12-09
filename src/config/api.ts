// API Configuration for Local Development vs Production
// In development: React calls Python API directly
// In production: React calls Edge Functions which proxy to Python API

export const API_CONFIG = {
  // Set to true to use direct API calls (bypassing edge functions)
  // Enable this when using ngrok or local development
  USE_DIRECT_API: true,

  // Python API URL - Set your ngrok URL here when testing from cloud preview
  // Example: 'https://abc123.ngrok-free.app' or 'http://localhost:5000' for local
  LOCAL_API_URL:
    import.meta.env.VITE_PYTHON_API_URL ||
    "https://palanquiningly-asparaginous-dia.ngrok-free.dev",

  // API endpoints matching the Flask backend
  ENDPOINTS: {
    // Dataset & Training
    SYNC_DATASET: "/api/dataset/sync",
    EXTRACT_EMBEDDINGS: "/api/train/extract-embeddings",
    TRAIN_MODEL: "/api/train/model",
    TRAINING_STATUS: "/api/train/status",

    // Recognition
    RECOGNIZE_IMAGE: "/api/recognize/image",
    RECOGNIZE_FRAME: "/api/recognize/frame",

    // Attendance
    MARK_ATTENDANCE: "/api/attendance/mark",

    // Health
    HEALTH: "/health",
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
