import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuditLog } from '@/hooks/useAuditLog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { Activity, User, Database, Image, FileText } from 'lucide-react';

const getEntityIcon = (type: string) => {
  switch (type) {
    case 'users':
      return User;
    case 'face_images':
      return Image;
    case 'attendance_logs':
      return FileText;
    default:
      return Database;
  }
};

const getActionColor = (action: string) => {
  if (action.includes('create') || action.includes('insert')) return 'default';
  if (action.includes('update') || action.includes('edit')) return 'secondary';
  if (action.includes('delete') || action.includes('remove')) return 'destructive';
  return 'outline';
};

export function AuditLogViewer() {
  const { logs, isLoading } = useAuditLog();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>Loading audit trail...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          <CardTitle>Audit Logs</CardTitle>
        </div>
        <CardDescription>System activity and security events</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px]">
          <div className="space-y-2">
            {logs?.map((log) => {
              const Icon = getEntityIcon(log.entity_type);
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="mt-1">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getActionColor(log.action) as any}>
                        {log.action}
                      </Badge>
                      <span className="text-sm font-medium">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="text-xs text-muted-foreground">
                          ID: {log.entity_id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                    {log.new_values && (
                      <div className="text-sm text-muted-foreground">
                        {JSON.stringify(log.new_values).slice(0, 100)}
                        {JSON.stringify(log.new_values).length > 100 ? '...' : ''}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                      {log.user_agent && (
                        <span className="truncate max-w-xs">
                          • {log.user_agent.split(' ')[0]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {(!logs || logs.length === 0) && (
              <div className="text-center py-8 text-muted-foreground">
                No audit logs found
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
