import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNotificationSound } from '@/hooks/useNotificationSound';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  isProcessing: boolean;
}

export default function CameraCapture({ onCapture, isProcessing }: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const { playSound } = useNotificationSound();

  const stopCamera = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
      setCountdown(null);
    }
  }, [stream]);

  const captureAndSubmit = useCallback(() => {
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
            const file = new File([blob], `attendance_${Date.now()}.jpg`, {
              type: 'image/jpeg',
            });
            stopCamera();
            playSound('success'); // Play success sound after capture
            onCapture(file);
            toast({
              title: 'Photo Captured',
              description: 'Marking attendance...',
            });
          }
        }, 'image/jpeg', 0.95);
      }
    }
  }, [onCapture, stopCamera, toast]);

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
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }
        
        // Start 5 second countdown
        setCountdown(5);
        countdownRef.current = setInterval(() => {
          setCountdown(prev => {
            if (prev === null || prev <= 1) {
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
              // Capture and submit when countdown reaches 0
              setTimeout(() => captureAndSubmit(), 100);
              return null;
            }
            // Play beep on each countdown second
            playSound('capture');
            return prev - 1;
          });
        }, 1000);
      }, 100);
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: 'Camera Access Denied',
        description: 'Please allow camera access to capture attendance photos',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Camera Capture</CardTitle>
        <CardDescription>Auto-captures after 5 seconds and marks attendance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
          {isCameraActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {countdown !== null && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="text-7xl font-bold text-white animate-pulse">
                    {countdown}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Camera className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {isProcessing ? 'Processing...' : 'Click "Start Camera" to begin'}
                </p>
              </div>
            </div>
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-2">
          {!isCameraActive && (
            <Button onClick={startCamera} className="flex-1" disabled={isProcessing}>
              <Camera className="mr-2 h-4 w-4" />
              {isProcessing ? 'Processing...' : 'Start Camera'}
            </Button>
          )}

          {isCameraActive && (
            <Button variant="outline" onClick={stopCamera} className="flex-1">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
