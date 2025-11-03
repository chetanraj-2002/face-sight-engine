import { AuditLogViewer } from '@/components/audit/AuditLogViewer';

export default function AuditLogs() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Logs</h1>
        <p className="text-muted-foreground">
          Track all system activities and security events
        </p>
      </div>

      <AuditLogViewer />
    </div>
  );
}
