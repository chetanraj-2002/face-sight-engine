import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, X, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  isProcessing: boolean;
}

export default function CameraCapture({ onCapture, isProcessing }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: 'user'
        }
      });
      
      setStream(mediaStream);
      setIsCameraActive(true);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Access Denied',
        description: 'Please allow camera access to capture attendance photos',
        variant: 'destructive',
      });
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            setCapturedImage(url);
            stopCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  const confirmCapture = () => {
    if (canvasRef.current) {
      canvasRef.current.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `attendance_${Date.now()}.jpg`, {
            type: 'image/jpeg',
          });
          onCapture(file);
          setCapturedImage(null);
        }
      }, 'image/jpeg', 0.95);
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera Capture</CardTitle>
        <CardDescription>Capture a group photo to mark attendance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {isCameraActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Captured"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click "Start Camera" to begin
                </p>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-2">
          {!isCameraActive && !capturedImage && (
            <Button onClick={startCamera} className="flex-1">
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          )}

          {isCameraActive && (
            <>
              <Button onClick={capturePhoto} className="flex-1">
                <Camera className="mr-2 h-4 w-4" />
                Capture Photo
              </Button>
              <Button variant="outline" onClick={stopCamera}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </>
          )}

          {capturedImage && (
            <>
              <Button
                onClick={confirmCapture}
                disabled={isProcessing}
                className="flex-1"
              >
                <Check className="mr-2 h-4 w-4" />
                {isProcessing ? 'Processing...' : 'Mark Attendance'}
              </Button>
              <Button variant="outline" onClick={retakePhoto}>
                <Camera className="mr-2 h-4 w-4" />
                Retake
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}