import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Camera, Square, Check, Upload, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationSound } from '@/hooks/useNotificationSound';

interface LiveCameraCaptureProps {
  userId: string;
  usn: string;
  onComplete: () => void;
}

export default function LiveCameraCapture({ userId, usn, onComplete }: LiveCameraCaptureProps) {
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureCount, setCaptureCount] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStartTime, setUploadStartTime] = useState<number | null>(null);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const { playSound } = useNotificationSound();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const IMAGES_PER_USER = 100;
  const CAPTURE_RATE_MS = 500; // 2 images per second

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      
      setStream(mediaStream);
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Failed to access camera. Please check permissions.');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
  };

  const captureFrame = (): string => {
    if (!videoRef.current || !canvasRef.current) return '';
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    if (!context) return '';
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    
    return canvas.toDataURL('image/jpeg', 0.8);
  };

  const startBurstCapture = async () => {
    setIsCapturing(true);
    setCaptureCount(0);
    const images: string[] = [];
    
    let count = 0;
    
    captureIntervalRef.current = setInterval(() => {
      if (count >= IMAGES_PER_USER) {
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
        }
        setIsCapturing(false);
        setCapturedImages(images);
        playSound('complete'); // Play completion sound
        uploadImages(images);
        return;
      }
      
      const imageData = captureFrame();
      if (imageData) {
        images.push(imageData);
        count++;
        setCaptureCount(count);
        
        // Play beep every 10 images
        if (count % 10 === 0) {
          playSound('capture');
        }
      }
    }, CAPTURE_RATE_MS);
  };

  const stopBurstCapture = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
    }
    setIsCapturing(false);
    
    if (capturedImages.length > 0) {
      toast.info(`Captured ${capturedImages.length} images. Uploading...`);
      uploadImages(capturedImages);
    }
  };

  const uploadImages = async (images: string[]) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStartTime(Date.now());
    setEstimatedTimeRemaining('Calculating...');
    
    // Simulate progress while uploading (since we can't get real-time progress from edge function)
    const estimatedDuration = images.length * 100; // ~100ms per image with parallel processing
    const startTime = Date.now();
    
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / estimatedDuration) * 95, 95); // Cap at 95% until complete
      setUploadProgress(progress);
      
      const remaining = Math.max(0, estimatedDuration - elapsed);
      if (remaining > 0) {
        const seconds = Math.ceil(remaining / 1000);
        setEstimatedTimeRemaining(seconds > 60 
          ? `~${Math.ceil(seconds / 60)}m ${seconds % 60}s` 
          : `~${seconds}s`);
      }
    }, 200);
    
    try {
      toast.info(`Uploading ${images.length} images...`);
      
      const { data, error } = await supabase.functions.invoke('auto-capture-upload', {
        body: {
          userId,
          usn,
          images
        }
      });

      if (error) throw error;

      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      
      setUploadProgress(100);
      setEstimatedTimeRemaining('Complete!');
      
      const uploadTime = data?.timeSeconds || ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (data?.batchComplete) {
        playSound('success');
        toast.success(data.message, {
          description: `Uploaded in ${uploadTime}s. Training pipeline started!`,
          duration: 5000,
        });
      } else {
        playSound('success');
        toast.success(data?.message || `Uploaded ${images.length} images in ${uploadTime}s!`);
      }

      stopCamera();
      onComplete();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      playSound('error');
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadStartTime(null);
    }
  };

  const progress = (captureCount / IMAGES_PER_USER) * 100;

  return (
    <div className="space-y-4">
      <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '4/3' }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        <canvas ref={canvasRef} className="hidden" />
        
        {isCapturing && (
          <div className="absolute top-4 left-4 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Capturing...
          </div>
        )}
        
        <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-sm rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white text-sm font-medium flex items-center gap-2">
              {isCapturing ? (
                <>
                  <Camera className="h-4 w-4" />
                  Capturing
                </>
              ) : isUploading ? (
                <>
                  <Upload className="h-4 w-4 animate-pulse" />
                  Uploading
                </>
              ) : 'Ready'}
            </span>
            <span className="text-white text-sm font-medium">
              {isUploading ? (
                <span className="flex items-center gap-2">
                  <span>{Math.round(uploadProgress)}%</span>
                  <span className="text-white/70 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {estimatedTimeRemaining}
                  </span>
                </span>
              ) : (
                `${captureCount}/${IMAGES_PER_USER}`
              )}
            </span>
          </div>
          <Progress value={isUploading ? uploadProgress : progress} className="h-2" />
        </div>
      </div>

      <div className="flex gap-2">
        {!isCapturing && !isUploading && (
          <Button
            onClick={startBurstCapture}
            className="flex-1"
            size="lg"
          >
            <Camera className="mr-2 h-5 w-5" />
            Start Auto Capture
          </Button>
        )}
        
        {isCapturing && (
          <Button
            onClick={stopBurstCapture}
            variant="destructive"
            className="flex-1"
            size="lg"
          >
            <Square className="mr-2 h-5 w-5" />
            Stop Capture
          </Button>
        )}

        {capturedImages.length > 0 && !isCapturing && !isUploading && (
          <Button
            variant="outline"
            className="flex-1"
            size="lg"
            disabled
          >
            <Check className="mr-2 h-5 w-5" />
            {capturedImages.length} Images Captured
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground text-center">
        {isCapturing 
          ? `Capturing ${IMAGES_PER_USER} images automatically at 2 images/second...`
          : isUploading
          ? 'Uploading images to server...'
          : `Click "Start Auto Capture" to capture ${IMAGES_PER_USER} images automatically`
        }
      </p>
    </div>
  );
}
