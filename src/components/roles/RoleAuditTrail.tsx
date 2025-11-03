import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { History, UserPlus, UserMinus, Edit3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';

interface AuditLog {
  id: string;
  user_id: string;
  performed_by: string;
  action: 'assigned' | 'removed' | 'modified';
  role: string;
  institute: string | null;
  department: string | null;
  details: any;
  created_at: string;
  user_profile?: { name: string; email: string | null };
  performer_profile?: { name: string };
}

export function RoleAuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const fetchAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('role_change_audit')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      
      // Fetch related profiles
      if (data) {
        const userIds = [...new Set([...data.map(d => d.user_id), ...data.map(d => d.performed_by)])];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        const enrichedData = data.map(log => ({
          ...log,
          user_profile: profileMap.get(log.user_id),
          performer_profile: profileMap.get(log.performed_by),
        }));
        
        setLogs(enrichedData as AuditLog[]);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'assigned':
        return <UserPlus className="h-4 w-4" />;
      case 'removed':
        return <UserMinus className="h-4 w-4" />;
      case 'modified':
        return <Edit3 className="h-4 w-4" />;
      default:
        return <History className="h-4 w-4" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'assigned':
        return 'text-green-500';
      case 'removed':
        return 'text-red-500';
      case 'modified':
        return 'text-blue-500';
      default:
        return 'text-muted-foreground';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Role Change Audit Trail
        </CardTitle>
        <CardDescription>
          Recent role assignments and modifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No audit logs yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${getActionColor(log.action)}`}>
                      {getActionIcon(log.action)}
                    </div>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">
                          {log.performer_profile?.name || 'Unknown'}
                        </span>
                        <span className="text-muted-foreground text-sm">
                          {log.action}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {log.role.replace('_', ' ')}
                        </Badge>
                        <span className="text-muted-foreground text-sm">
                          {log.action === 'assigned' ? 'to' : 'from'}
                        </span>
                        <span className="font-medium">
                          {log.user_profile?.name || 'Unknown User'}
                        </span>
                      </div>
                      
                      {(log.institute || log.department) && (
                        <div className="text-xs text-muted-foreground">
                          {log.institute && `Institute: ${log.institute}`}
                          {log.institute && log.department && ' • '}
                          {log.department && `Department: ${log.department}`}
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}