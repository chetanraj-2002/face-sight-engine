# Use official lightweight Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install OpenCV dependencies (libGL + others)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy your application code
COPY . .

# Expose your app port if running a web service (Flask etc.)
EXPOSE 5000

# Default command to run app
CMD ["python", "app.py"]
