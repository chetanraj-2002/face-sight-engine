import { useState, useEffect } from 'react';
import { Check, Copy, Mail, Key, CheckCircle, AlertTriangle, Camera, SkipForward } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface CredentialsDialogProps {
  open: boolean;
  onClose: () => void;
  onCreateAnother?: () => void;
  onCaptureFace?: () => void;
  onSkipFaceCapture?: () => void;
  credentials: {
    email: string;
    password: string;
    emailSent: boolean;
  } | null;
  userType?: string;
  showFaceCaptureOption?: boolean;
  autoProceedException?: boolean;
}

export function CredentialsDialog({ 
  open, 
  onClose, 
  onCreateAnother,
  onCaptureFace,
  onSkipFaceCapture,
  credentials, 
  userType = 'User',
  showFaceCaptureOption = false,
  autoProceedException = true
}: CredentialsDialogProps) {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [countdown, setCountdown] = useState(15);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-proceed countdown for face capture
  useEffect(() => {
    if (!open || !showFaceCaptureOption || !autoProceedException || isPaused) {
      setCountdown(15);
      return;
    }

    if (countdown <= 0 && onCaptureFace) {
      onCaptureFace();
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(prev => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [open, countdown, showFaceCaptureOption, autoProceedException, isPaused, onCaptureFace]);

  // Reset countdown when dialog opens
  useEffect(() => {
    if (open) {
      setCountdown(15);
      setIsPaused(false);
    }
  }, [open]);

  if (!credentials) return null;

  const copyToClipboard = async (text: string, type: 'email' | 'password' | 'all') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'email') {
        setCopiedEmail(true);
        setTimeout(() => setCopiedEmail(false), 2000);
      } else if (type === 'password') {
        setCopiedPassword(true);
        setTimeout(() => setCopiedPassword(false), 2000);
      } else {
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const allCredentials = `Email: ${credentials.email}\nPassword: ${credentials.password}`;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            {userType} Created Successfully
          </DialogTitle>
          <DialogDescription>
            {showFaceCaptureOption 
              ? 'Credentials generated. Now capture face data for attendance.' 
              : 'Credentials have been generated. Share them with the user.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Email Status Badge */}
          <div className="flex justify-center">
            {credentials.emailSent ? (
              <Badge variant="default" className="bg-green-500/10 text-green-600 border-green-500/20">
                <Mail className="h-3 w-3 mr-1" />
                Credentials sent via email
              </Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Email failed - share manually
              </Badge>
            )}
          </div>

          {/* Email Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Mail className="h-3 w-3" />
              Email
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono">
                {credentials.email}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(credentials.email, 'email')}
              >
                {copiedEmail ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <Key className="h-3 w-3" />
              Password
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono">
                {credentials.password}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(credentials.password, 'password')}
              >
                {copiedPassword ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Copy All Button */}
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => copyToClipboard(allCredentials, 'all')}
          >
            {copiedAll ? (
              <>
                <Check className="h-4 w-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-2" />
                Copy All Credentials
              </>
            )}
          </Button>
        </div>

        {/* Auto-proceed countdown for face capture */}
        {showFaceCaptureOption && autoProceedException && !isPaused && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Proceeding to face capture in {countdown}s...</span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setIsPaused(true)}
              >
                Pause
              </Button>
            </div>
            <Progress value={((15 - countdown) / 15) * 100} className="h-1" />
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {showFaceCaptureOption && onCaptureFace ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => {
                  onSkipFaceCapture?.();
                  onClose();
                }}
                className="w-full sm:w-auto"
              >
                <SkipForward className="h-4 w-4 mr-2" />
                Skip for Now
              </Button>
              <Button 
                onClick={onCaptureFace} 
                className="w-full sm:w-auto"
              >
                <Camera className="h-4 w-4 mr-2" />
                {isPaused ? 'Capture Face Data' : `Capture Now`}
              </Button>
            </>
          ) : (
            <>
              {onCreateAnother && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    onClose();
                    onCreateAnother();
                  }}
                  className="w-full sm:w-auto"
                >
                  Create Another
                </Button>
              )}
              <Button onClick={onClose} className="w-full sm:w-auto">
                Close
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
