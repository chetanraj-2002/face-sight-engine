# Local Development Setup

This guide explains how to run the face recognition system locally for development.

## Architecture

```
┌─────────────────┐     HTTP      ┌─────────────────┐
│   React App     │ ────────────► │  Python Flask   │
│  (localhost:    │               │  (localhost:    │
│   5173/8080)    │               │   5000)         │
└─────────────────┘               └─────────────────┘
        │                                 │
        │ (Supabase SDK)                  │ (Database queries)
        ▼                                 ▼
┌─────────────────────────────────────────────────────┐
│                   Supabase Cloud                     │
│  (Database, Auth, Storage - always cloud-based)     │
└─────────────────────────────────────────────────────┘
```

In **development mode**, the React app calls the Python API directly via HTTP.
In **production mode**, the React app calls Edge Functions which proxy to the Python API.

## Prerequisites

1. Python 3.8+ with pip
2. Node.js 18+ with npm
3. Supabase account (for database/storage)

## Setup Steps

### 1. Start the Python Backend

```bash
# Navigate to the Python API directory
cd PyImageSearch

# Create virtual environment (first time only)
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export SUPABASE_URL="your-supabase-url"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Start the Flask server
python app.py
```

The Flask server will start on `http://localhost:5000`

### 2. Start the React Frontend

```bash
# In a new terminal, from the project root
npm install
npm run dev
```

The React app will start on `http://localhost:5173` (or similar)

### 3. Verify Connection

1. Open your browser to the React app URL
2. Open browser DevTools (F12) → Console
3. Try any training/recognition action
4. You should see logs like:
   ```
   [Training] Using direct API for sync-dataset
   [API Client] POST http://localhost:5000/api/sync/dataset
   ```

## API Endpoints

The Python backend exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/sync/dataset` | POST | Sync dataset from Supabase |
| `/api/train/embeddings` | POST | Extract face embeddings |
| `/api/train/model` | POST | Train recognition model |
| `/api/train/status/:job_id` | GET | Get training job status |
| `/api/recognize/image` | POST | Recognize faces in image |
| `/api/recognize/frame` | POST | Recognize faces in video frame |
| `/api/attendance/mark` | POST | Mark attendance |

## Configuration

### Switching Between Local and Production

The API configuration is in `src/config/api.ts`:

```typescript
export const API_CONFIG = {
  // Automatically uses direct API in development mode
  USE_DIRECT_API: import.meta.env.DEV,
  
  // Change this if Flask runs on a different port
  LOCAL_API_URL: 'http://localhost:5000',
};
```

- `import.meta.env.DEV` is `true` when running `npm run dev`
- `import.meta.env.DEV` is `false` when running `npm run build`

### Manual Override

To force production mode locally (test edge functions):
```typescript
USE_DIRECT_API: false, // Always use edge functions
```

To force local mode in production (not recommended):
```typescript
USE_DIRECT_API: true, // Always use direct API
```

## Troubleshooting

### "Cannot connect to Python API"

1. Ensure Flask is running: `python app.py`
2. Check it's on port 5000: `http://localhost:5000/health`
3. Check for CORS errors in browser console

### CORS Issues

The Flask app should have CORS configured. If you see CORS errors:

```python
# In app.py, ensure this is present:
from flask_cors import CORS
CORS(app)
```

### Database Connection Issues

The Python API needs Supabase credentials:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Moving to Production

When deploying to AWS:

1. Deploy the Python API to AWS (ECS, Lambda, etc.)
2. Get the public URL (e.g., `https://api.yourdomain.com`)
3. Update the `PYTHON_API_URL` secret in Supabase Edge Functions
4. Build the React app with `npm run build`
5. The production build will automatically use Edge Functions

No code changes needed - just build and deploy!
