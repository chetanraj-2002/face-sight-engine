import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Trash2, Building2, Building } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface UserRole {
  id: string;
  user_id: string;
  role: string;
  institute: string | null;
  department: string | null;
  created_at: string;
  profile?: {
    name: string;
    email: string | null;
  };
}

interface UserRolesListProps {
  filterRole?: string;
  onRoleRemoved?: () => void;
}

export function UserRolesList({ filterRole, onRoleRemoved }: UserRolesListProps) {
  const { profile } = useAuth();
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    fetchRoles();
  }, [filterRole, profile]);

  const fetchRoles = async () => {
    try {
      let query = supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      // Apply role filter
      if (filterRole) {
        query = query.eq('role', filterRole as any);
      }

      // Apply scope-based filtering
      if (profile?.role === 'institute_admin' && profile.institute) {
        query = query.eq('institute', profile.institute);
      } else if (profile?.role === 'department_admin' && profile.department) {
        query = query.eq('department', profile.department);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Fetch related profiles
      if (data) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        const enrichedData = data.map(role => ({
          ...role,
          profile: profileMap.get(role.user_id),
        }));
        
        setRoles(enrichedData as UserRole[]);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load user roles');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRole = async (roleId: string, userId: string, role: string) => {
    setRemoving(roleId);
    try {
      // First, delete the role
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('id', roleId);

      if (deleteError) throw deleteError;

      // Log the audit trail
      if (profile?.id) {
        await supabase.from('role_change_audit').insert({
          user_id: userId,
          performed_by: profile.id,
          action: 'removed',
          role: role as any,
          institute: profile.institute,
          department: profile.department,
        });
      }

      toast.success('Role removed successfully');
      fetchRoles();
      onRoleRemoved?.();
    } catch (error: any) {
      console.error('Error removing role:', error);
      toast.error(error.message || 'Failed to remove role');
    } finally {
      setRemoving(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
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
          <Users className="h-5 w-5" />
          Assigned Users
          <Badge variant="secondary" className="ml-auto">
            {roles.length}
          </Badge>
        </CardTitle>
        <CardDescription>
          Users with assigned roles in your scope
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {roles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No users found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {roles.map((userRole) => (
                <div
                  key={userRole.id}
                  className="rounded-lg border p-3 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {userRole.profile?.name || 'Unknown User'}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {userRole.role.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="text-xs text-muted-foreground">
                        {userRole.profile?.email}
                      </div>
                      
                      {(userRole.institute || userRole.department) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {userRole.institute && (
                            <div className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {userRole.institute}
                            </div>
                          )}
                          {userRole.department && (
                            <div className="flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {userRole.department}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={removing === userRole.id}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove Role</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove the {userRole.role.replace('_', ' ')} role from{' '}
                            {userRole.profile?.name}? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveRole(userRole.id, userRole.user_id, userRole.role)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove Role
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
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