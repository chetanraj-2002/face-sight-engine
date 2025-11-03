import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Camera, Square, Check } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const captureIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
        uploadImages(images);
        return;
      }
      
      const imageData = captureFrame();
      if (imageData) {
        images.push(imageData);
        count++;
        setCaptureCount(count);
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

      setUploadProgress(100);
      
      if (data?.batchComplete) {
        toast.success(data.message, {
          description: 'Training pipeline started automatically!',
          duration: 5000,
        });
      } else {
        toast.success(data?.message || `Uploaded ${images.length} images successfully!`);
      }

      stopCamera();
      onComplete();
      
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(`Upload failed: ${error.message}`);
    } finally {
      setIsUploading(false);
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
            <span className="text-white text-sm font-medium">
              {isCapturing ? 'Capturing' : isUploading ? 'Uploading' : 'Ready'}
            </span>
            <span className="text-white text-sm font-medium">
              {captureCount}/{IMAGES_PER_USER}
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
