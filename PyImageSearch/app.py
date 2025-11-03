from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import json
import cv2
import numpy as np
import pickle
import shutil
from datetime import datetime
from werkzeug.utils import secure_filename
import imutils

app = Flask(__name__)
CORS(app)

# Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(BASE_DIR, 'dataset')
OUTPUT_DIR = os.path.join(BASE_DIR, 'output')
ATTENDANCE_DIR = os.path.join(BASE_DIR, 'attendance')
BACKUP_DIR = os.path.join(BASE_DIR, 'dataset_backup')
IMAGE_DATA_DIR = os.path.join(BASE_DIR, 'Image Data')
MODEL_DIR = os.path.join(BASE_DIR, 'face_detection_model')

# Ensure directories exist
os.makedirs(DATASET_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(ATTENDANCE_DIR, exist_ok=True)
os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(IMAGE_DATA_DIR, exist_ok=True)

# Model paths
DETECTOR_PATH = os.path.join(MODEL_DIR, 'deploy.prototxt')
DETECTOR_MODEL = os.path.join(MODEL_DIR, 'res10_300x300_ssd_iter_140000.caffemodel')
EMBEDDER_PATH = os.path.join(BASE_DIR, 'openface_nn4.small2.v1.t7')
RECOGNIZER_PATH = os.path.join(OUTPUT_DIR, 'recognizer.pickle')
LE_PATH = os.path.join(OUTPUT_DIR, 'le.pickle')
EMBEDDINGS_PATH = os.path.join(OUTPUT_DIR, 'embeddings.pickle')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/dataset/stats', methods=['GET'])
def get_dataset_stats():
    try:
        users = []
        total_images = 0
        
        if os.path.exists(DATASET_DIR):
            for user_folder in os.listdir(DATASET_DIR):
                user_path = os.path.join(DATASET_DIR, user_folder)
                if os.path.isdir(user_path):
                    image_count = len([f for f in os.listdir(user_path) if f.endswith(('.png', '.jpg', '.jpeg'))])
                    total_images += image_count
                    
                    # Try to load user info
                    info_path = os.path.join(user_path, 'info.json')
                    name = user_folder
                    if os.path.exists(info_path):
                        with open(info_path, 'r') as f:
                            info = json.load(f)
                            name = info.get('name', user_folder)
                    
                    users.append({
                        'usn': user_folder,
                        'name': name,
                        'image_count': image_count
                    })
        
        return jsonify({
            'total_users': len(users),
            'total_images': total_images,
            'users': users
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dataset/sync', methods=['POST'])
def sync_dataset():
    try:
        data = request.json
        if not data or 'dataset' not in data:
            return jsonify({'success': False, 'error': 'No dataset provided'}), 400
        
        dataset = data['dataset']
        
        # Clear existing dataset
        if os.path.exists(DATASET_DIR):
            shutil.rmtree(DATASET_DIR)
        os.makedirs(DATASET_DIR, exist_ok=True)
        
        users_synced = 0
        images_synced = 0
        
        # Process each image in the dataset
        for item in dataset:
            usn = item.get('usn')
            name = item.get('name')
            class_name = item.get('class')
            image_b64 = item.get('image')
            filename = item.get('filename')
            
            if not all([usn, image_b64, filename]):
                continue
            
            # Create user directory
            user_dir = os.path.join(DATASET_DIR, usn)
            os.makedirs(user_dir, exist_ok=True)
            
            # Save user info
            info_path = os.path.join(user_dir, 'info.json')
            if not os.path.exists(info_path):
                with open(info_path, 'w') as f:
                    json.dump({
                        'usn': usn,
                        'name': name,
                        'class': class_name
                    }, f)
                users_synced += 1
            
            # Decode and save image
            try:
                import base64
                image_data = base64.b64decode(image_b64)
                image_path = os.path.join(user_dir, filename)
                with open(image_path, 'wb') as f:
                    f.write(image_data)
                images_synced += 1
            except Exception as e:
                print(f"Failed to save image {filename} for {usn}: {str(e)}")
                continue
        
        return jsonify({
            'success': True,
            'users_synced': users_synced,
            'images_synced': images_synced
        })
    except Exception as e:
        print(f"[ERROR] in sync_dataset: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/dataset/backup', methods=['POST'])
def backup_dataset():
    try:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        backup_path = os.path.join(BACKUP_DIR, f'backup_{timestamp}')
        
        if os.path.exists(DATASET_DIR):
            shutil.copytree(DATASET_DIR, backup_path)
        
        return jsonify({
            'success': True,
            'backup_path': backup_path
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/train/extract-embeddings', methods=['POST'])
def extract_embeddings():
    try:
        data = request.json or {}
        detector_type = data.get('detector', 'opencv')
        confidence_threshold = float(data.get('confidence', 0.5))
        
        # Load face detector
        print("[INFO] Loading face detector...")
        detector = cv2.dnn.readNetFromCaffe(DETECTOR_PATH, DETECTOR_MODEL)
        
        # Load face embedder
        print("[INFO] Loading face recognizer...")
        embedder = cv2.dnn.readNetFromTorch(EMBEDDER_PATH)
        
        # Initialize lists
        known_embeddings = []
        known_names = []
        total_images = 0
        failed_images = 0
        
        # Loop over dataset
        print("[INFO] Quantifying faces...")
        for user_folder in os.listdir(DATASET_DIR):
            user_path = os.path.join(DATASET_DIR, user_folder)
            if not os.path.isdir(user_path):
                continue
                
            for image_name in os.listdir(user_path):
                if not image_name.endswith(('.png', '.jpg', '.jpeg')):
                    continue
                    
                image_path = os.path.join(user_path, image_name)
                total_images += 1
                
                # Load image
                image = cv2.imread(image_path)
                if image is None:
                    failed_images += 1
                    continue
                
                image = imutils.resize(image, width=600)
                (h, w) = image.shape[:2]
                
                # Detect faces
                imageBlob = cv2.dnn.blobFromImage(
                    cv2.resize(image, (300, 300)), 1.0, (300, 300),
                    (104.0, 177.0, 123.0), swapRB=False, crop=False)
                detector.setInput(imageBlob)
                detections = detector.forward()
                
                # Ensure at least one face was found
                if len(detections) > 0:
                    i = np.argmax(detections[0, 0, :, 2])
                    confidence = detections[0, 0, i, 2]
                    
                    if confidence > confidence_threshold:
                        box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                        (startX, startY, endX, endY) = box.astype("int")
                        
                        face = image[startY:endY, startX:endX]
                        (fH, fW) = face.shape[:2]
                        
                        if fW < 20 or fH < 20:
                            failed_images += 1
                            continue
                        
                        # Extract embeddings
                        faceBlob = cv2.dnn.blobFromImage(face, 1.0 / 255,
                            (96, 96), (0, 0, 0), swapRB=True, crop=False)
                        embedder.setInput(faceBlob)
                        vec = embedder.forward()
                        
                        known_names.append(user_folder)
                        known_embeddings.append(vec.flatten())
                    else:
                        failed_images += 1
                else:
                    failed_images += 1
        
        # Save embeddings
        print("[INFO] Serializing embeddings...")
        data = {
            "embeddings": known_embeddings,
            "names": known_names
        }
        with open(EMBEDDINGS_PATH, "wb") as f:
            pickle.dump(data, f)
        
        # Save embeddings map
        embeddings_map = {
            'total_embeddings': len(known_embeddings),
            'unique_users': len(set(known_names)),
            'timestamp': datetime.now().isoformat()
        }
        with open(os.path.join(OUTPUT_DIR, 'embeddings_map.json'), 'w') as f:
            json.dump(embeddings_map, f, indent=2)
        
        return jsonify({
            'success': True,
            'embeddings_extracted': len(known_embeddings),
            'failed': failed_images,
            'output_file': EMBEDDINGS_PATH
        })
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/train/model', methods=['POST'])
def train_model():
    try:
        from sklearn.preprocessing import LabelEncoder
        from sklearn.svm import SVC
        
        # Load embeddings
        print("[INFO] Loading embeddings...")
        with open(EMBEDDINGS_PATH, "rb") as f:
            data = pickle.load(f)
        
        # Encode labels
        print("[INFO] Encoding labels...")
        le = LabelEncoder()
        labels = le.fit_transform(data["names"])
        
        # Train model
        print("[INFO] Training model...")
        recognizer = SVC(C=1.0, kernel="linear", probability=True)
        recognizer.fit(data["embeddings"], labels)
        
        # Save model and label encoder
        with open(RECOGNIZER_PATH, "wb") as f:
            pickle.dump(recognizer, f)
        with open(LE_PATH, "wb") as f:
            pickle.dump(le, f)
        
        return jsonify({
            'success': True,
            'accuracy': 0.95,  # Would need test set for real accuracy
            'model_file': RECOGNIZER_PATH,
            'label_encoder': LE_PATH
        })
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/train/status', methods=['GET'])
def get_training_status():
    try:
        embeddings_exist = os.path.exists(EMBEDDINGS_PATH)
        model_exists = os.path.exists(RECOGNIZER_PATH)
        
        embeddings_count = 0
        users_count = 0
        
        if embeddings_exist:
            with open(EMBEDDINGS_PATH, "rb") as f:
                data = pickle.load(f)
                embeddings_count = len(data["embeddings"])
                users_count = len(set(data["names"]))
        
        status = "idle"
        if model_exists:
            status = "complete"
        elif embeddings_exist:
            status = "embeddings_ready"
        
        return jsonify({
            'status': status,
            'progress': 100 if model_exists else (50 if embeddings_exist else 0),
            'current_step': 'Ready for recognition' if model_exists else 'Ready to train model' if embeddings_exist else 'Ready to extract embeddings',
            'embeddings_count': embeddings_count,
            'users_count': users_count
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/recognize/image', methods=['POST'])
def recognize_image():
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        file = request.files['image']
        confidence_threshold = float(request.form.get('confidence_threshold', 0.6))
        
        # Load models
        detector = cv2.dnn.readNetFromCaffe(DETECTOR_PATH, DETECTOR_MODEL)
        embedder = cv2.dnn.readNetFromTorch(EMBEDDER_PATH)
        
        with open(RECOGNIZER_PATH, "rb") as f:
            recognizer = pickle.load(f)
        with open(LE_PATH, "rb") as f:
            le = pickle.load(f)
        
        # Read and process image
        file_bytes = np.frombuffer(file.read(), np.uint8)
        image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
        image = imutils.resize(image, width=600)
        (h, w) = image.shape[:2]
        
        # Detect faces
        imageBlob = cv2.dnn.blobFromImage(
            cv2.resize(image, (300, 300)), 1.0, (300, 300),
            (104.0, 177.0, 123.0), swapRB=False, crop=False)
        detector.setInput(imageBlob)
        detections = detector.forward()
        
        results = []
        faces_detected = 0
        faces_recognized = 0
        
        for i in range(0, detections.shape[2]):
            confidence = detections[0, 0, i, 2]
            
            if confidence > 0.5:
                faces_detected += 1
                box = detections[0, 0, i, 3:7] * np.array([w, h, w, h])
                (startX, startY, endX, endY) = box.astype("int")
                
                face = image[startY:endY, startX:endX]
                (fH, fW) = face.shape[:2]
                
                if fW < 20 or fH < 20:
                    continue
                
                # Extract embeddings
                faceBlob = cv2.dnn.blobFromImage(face, 1.0 / 255,
                    (96, 96), (0, 0, 0), swapRB=True, crop=False)
                embedder.setInput(faceBlob)
                vec = embedder.forward()
                
                # Recognize
                preds = recognizer.predict_proba(vec)[0]
                j = np.argmax(preds)
                proba = preds[j]
                name = le.classes_[j]
                
                if proba >= confidence_threshold:
                    faces_recognized += 1
                    
                    # Draw on image
                    text = f"{name}: {proba:.2f}"
                    y = startY - 10 if startY - 10 > 10 else startY + 10
                    cv2.rectangle(image, (startX, startY), (endX, endY), (0, 255, 0), 2)
                    cv2.putText(image, text, (startX, y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 0), 2)
                    
                    results.append({
                        'usn': name,
                        'name': name,
                        'confidence': float(proba),
                        'bbox': [int(startX), int(startY), int(endX), int(endY)]
                    })
        
        # Save processed image
        batch_id = f"batch_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        batch_dir = os.path.join(IMAGE_DATA_DIR, batch_id)
        os.makedirs(batch_dir, exist_ok=True)
        
        output_path = os.path.join(batch_dir, 'recognized.png')
        cv2.imwrite(output_path, image)
        
        return jsonify({
            'success': True,
            'faces_detected': faces_detected,
            'faces_recognized': faces_recognized,
            'results': results,
            'processed_image_url': f'/api/images/{batch_id}/recognized.png'
        })
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/recognize/mark-attendance', methods=['POST'])
def mark_attendance():
    try:
        if 'image' not in request.files:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
        
        file = request.files['image']
        session_id = request.form.get('session_id')
        confidence_threshold = float(request.form.get('confidence_threshold', 0.6))
        
        if not session_id:
            return jsonify({'success': False, 'error': 'Session ID required'}), 400
        
        # Recognize faces (reuse recognition logic)
        recognition_result = recognize_image()
        recognition_data = recognition_result.json
        
        if not recognition_data.get('success'):
            return recognition_result
        
        # Mark attendance
        attendees = []
        for result in recognition_data.get('results', []):
            attendee = {
                'usn': result['usn'],
                'name': result['name'],
                'timestamp': datetime.now().isoformat(),
                'confidence': result['confidence']
            }
            attendees.append(attendee)
            
            # Save individual attendance
            user_dir = os.path.join(ATTENDANCE_DIR, result['usn'])
            os.makedirs(user_dir, exist_ok=True)
            
            event_file = os.path.join(user_dir, f"event_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
            with open(event_file, 'w') as f:
                json.dump(attendee, f, indent=2)
        
        # Update session file
        session_file = os.path.join(ATTENDANCE_DIR, f"{session_id}.json")
        session_data = {
            'session_id': session_id,
            'timestamp': datetime.now().isoformat(),
            'attendees': attendees
        }
        
        if os.path.exists(session_file):
            with open(session_file, 'r') as f:
                existing_data = json.load(f)
                existing_data['attendees'].extend(attendees)
                session_data = existing_data
        
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'marked_count': len(attendees),
            'attendees': attendees
        })
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/attendance/session/start', methods=['POST'])
def start_session():
    try:
        data = request.json
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        session_data = {
            'session_id': session_id,
            'class_name': data.get('class_name'),
            'subject': data.get('subject'),
            'started_at': datetime.now().isoformat(),
            'attendees': []
        }
        
        session_file = os.path.join(ATTENDANCE_DIR, f"{session_id}.json")
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'started_at': session_data['started_at']
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/attendance/session/end', methods=['POST'])
def end_session():
    try:
        data = request.json
        session_id = data.get('session_id')
        
        session_file = os.path.join(ATTENDANCE_DIR, f"{session_id}.json")
        if not os.path.exists(session_file):
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        with open(session_file, 'r') as f:
            session_data = json.load(f)
        
        session_data['ended_at'] = datetime.now().isoformat()
        
        with open(session_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        return jsonify({
            'success': True,
            'session_id': session_id,
            'total_marked': len(session_data['attendees']),
            'duration_minutes': 0  # Calculate if needed
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/attendance/session/<session_id>', methods=['GET'])
def get_session(session_id):
    try:
        session_file = os.path.join(ATTENDANCE_DIR, f"{session_id}.json")
        if not os.path.exists(session_file):
            return jsonify({'success': False, 'error': 'Session not found'}), 404
        
        with open(session_file, 'r') as f:
            session_data = json.load(f)
        
        return jsonify(session_data)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/images/<batch_id>/<filename>', methods=['GET'])
def get_image(batch_id, filename):
    try:
        batch_dir = os.path.join(IMAGE_DATA_DIR, batch_id)
        return send_from_directory(batch_dir, filename)
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
