# Face Recognition API Documentation

Base URL: `http://localhost:5000` (local) or your AWS deployment URL

## Health Check

### GET /health
Check API status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-03T12:00:00"
}
```

---

## Dataset Management

### POST /api/dataset/sync
Sync dataset from Supabase storage.

**Request Body:**
```json
{
  "supabase_url": "https://your-project.supabase.co",
  "bucket_name": "face-images"
}
```

**Response:**
```json
{
  "success": true,
  "users_synced": 5,
  "total_images": 250
}
```

### GET /api/dataset/stats
Get dataset statistics.

**Response:**
```json
{
  "total_users": 5,
  "total_images": 250,
  "users": [
    {
      "usn": "4BD22IS036",
      "name": "John Doe",
      "image_count": 50
    }
  ]
}
```

### POST /api/dataset/backup
Create dataset backup.

**Response:**
```json
{
  "success": true,
  "backup_path": "dataset_backup/backup_20251103_120000"
}
```

---

## Training

### POST /api/train/extract-embeddings
Extract face embeddings from dataset.

**Request Body:**
```json
{
  "detector": "opencv",
  "confidence": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "embeddings_extracted": 245,
  "failed": 5,
  "output_file": "output/embeddings.pickle"
}
```

### POST /api/train/model
Train recognition model from embeddings.

**Response:**
```json
{
  "success": true,
  "accuracy": 0.95,
  "model_file": "output/recognizer.pickle",
  "label_encoder": "output/le.pickle"
}
```

### GET /api/train/status
Get current training status.

**Response:**
```json
{
  "status": "idle|extracting|training|complete",
  "progress": 75,
  "current_step": "Training SVM model",
  "embeddings_count": 245,
  "users_count": 5
}
```

---

## Recognition

### POST /api/recognize/image
Recognize faces in uploaded image.

**Request:** multipart/form-data
- `image`: Image file (required)
- `confidence_threshold`: float (optional, default: 0.6)

**Response:**
```json
{
  "success": true,
  "faces_detected": 2,
  "faces_recognized": 2,
  "results": [
    {
      "usn": "4BD22IS036",
      "name": "John Doe",
      "confidence": 0.85,
      "bbox": [100, 150, 250, 300]
    }
  ],
  "processed_image_url": "/api/images/batch_20251103_120000/recognized.png"
}
```

### POST /api/recognize/mark-attendance
Recognize and mark attendance.

**Request:** multipart/form-data
- `image`: Image file (required)
- `session_id`: string (required)
- `confidence_threshold`: float (optional, default: 0.6)

**Response:**
```json
{
  "success": true,
  "session_id": "session_20251103_120000",
  "marked_count": 2,
  "attendees": [
    {
      "usn": "4BD22IS036",
      "name": "John Doe",
      "timestamp": "2025-11-03T12:00:00",
      "confidence": 0.85
    }
  ]
}
```

---

## Attendance Management

### POST /api/attendance/session/start
Start new attendance session.

**Request Body:**
```json
{
  "class_name": "Computer Science A",
  "subject": "Artificial Intelligence"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "session_20251103_120000",
  "started_at": "2025-11-03T12:00:00"
}
```

### POST /api/attendance/session/end
End attendance session.

**Request Body:**
```json
{
  "session_id": "session_20251103_120000"
}
```

**Response:**
```json
{
  "success": true,
  "session_id": "session_20251103_120000",
  "total_marked": 25,
  "duration_minutes": 45
}
```

### GET /api/attendance/session/:session_id
Get session details.

**Response:**
```json
{
  "session_id": "session_20251103_120000",
  "class_name": "Computer Science A",
  "subject": "Artificial Intelligence",
  "started_at": "2025-11-03T12:00:00",
  "ended_at": "2025-11-03T12:45:00",
  "attendees": [
    {
      "usn": "4BD22IS036",
      "name": "John Doe",
      "timestamp": "2025-11-03T12:00:00",
      "confidence": 0.85
    }
  ]
}
```

### GET /api/attendance/export/:session_id
Export session attendance as JSON/CSV.

**Query Parameters:**
- `format`: "json" or "csv" (optional, default: "json")

**Response:** File download

---

## Static Files

### GET /api/images/:batch_id/:filename
Get processed image.

**Example:**
```
GET /api/images/batch_20251103_120000/recognized.png
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "success": false,
  "error": "Error message description"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid input)
- `404`: Not found
- `500`: Internal server error
