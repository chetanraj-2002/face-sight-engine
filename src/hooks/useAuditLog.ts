import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

interface AuditLogEntry {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: any;
  new_values: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const useAuditLog = () => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const logAction = async (
    action: string,
    entityType: string,
    entityId?: string,
    oldValues?: any,
    newValues?: any
  ) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('audit_logs')
        .insert({
          user_id: user?.id || null,
          action,
          entity_type: entityType,
          entity_id: entityId || null,
          old_values: oldValues || null,
          new_values: newValues || null,
          ip_address: null, // Could be enhanced with actual IP
          user_agent: navigator.userAgent,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Failed to log audit action:', error);
    }
  };

  return {
    logs,
    isLoading,
    logAction,
  };
};
