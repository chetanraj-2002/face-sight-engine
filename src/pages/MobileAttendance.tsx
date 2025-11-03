import { QRCodeGenerator } from '@/components/mobile/QRCodeGenerator';

export default function MobileAttendance() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Mobile Attendance</h1>
        <p className="text-muted-foreground">
          QR code based attendance marking for mobile devices
        </p>
      </div>

      <div className="max-w-2xl">
        <QRCodeGenerator />
      </div>

      <div className="rounded-lg border p-6 space-y-4">
        <h2 className="text-xl font-semibold">Mobile API Endpoints</h2>
        <div className="space-y-3 text-sm">
          <div className="p-3 rounded bg-secondary">
            <div className="font-mono font-medium">POST /functions/v1/mobile-mark-attendance</div>
            <p className="text-muted-foreground mt-1">Mark attendance via mobile app with face recognition</p>
          </div>
          <div className="p-3 rounded bg-secondary">
            <div className="font-mono font-medium">POST /functions/v1/generate-session-qr</div>
            <p className="text-muted-foreground mt-1">Generate QR code for session joining</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          These endpoints can be integrated with mobile applications for seamless attendance marking.
        </p>
      </div>
    </div>
  );
}
