import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'react-qr-code';

export function QRCodeGenerator() {
  const [sessionId, setSessionId] = useState('');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [qrData, setQrData] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const { toast } = useToast();

  const generateQR = async () => {
    if (!sessionId || !className) {
      toast({
        title: 'Missing Information',
        description: 'Please provide session ID and class name',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-session-qr', {
        body: { sessionId, className, subject, validMinutes: 30 },
      });

      if (error) throw error;

      setQrData(data.qrData);
      
      toast({
        title: 'QR Code Generated',
        description: 'Students can scan this code to join the session',
      });
    } catch (error: any) {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          <CardTitle>Session QR Code</CardTitle>
        </div>
        <CardDescription>Generate QR code for mobile attendance marking</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sessionId">Session ID</Label>
          <Input
            id="sessionId"
            placeholder="Enter session ID"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="className">Class Name</Label>
          <Input
            id="className"
            placeholder="Enter class name"
            value={className}
            onChange={(e) => setClassName(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject">Subject (Optional)</Label>
          <Input
            id="subject"
            placeholder="Enter subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <Button
          onClick={generateQR}
          disabled={generating}
          className="w-full"
        >
          {generating ? 'Generating...' : 'Generate QR Code'}
        </Button>

        {qrData && (
          <div className="flex flex-col items-center gap-4 p-4 border rounded-lg bg-white">
            <QRCode value={qrData} size={256} />
            <p className="text-sm text-muted-foreground text-center">
              Valid for 30 minutes • Students scan to mark attendance
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
