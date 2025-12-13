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
import { Users, Trash2, Building2, Building, Camera, ImageOff } from 'lucide-react';
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
    usn: string | null;
  };
  datasetUser?: {
    id: string;
    usn: string;
    image_count: number;
  } | null;
}

interface UserRolesListProps {
  filterRole?: string;
  onRoleRemoved?: () => void;
  onCaptureFace?: (userId: string, usn: string, name: string) => void;
}

export function UserRolesList({ filterRole, onRoleRemoved, onCaptureFace }: UserRolesListProps) {
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
      
      // Fetch related profiles and dataset users
      if (data) {
        const userIds = data.map(d => d.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, email, usn')
          .in('id', userIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]));
        
        // Fetch dataset users by USN to check image counts
        const usns = profiles?.filter(p => p.usn).map(p => p.usn) || [];
        const { data: datasetUsers } = await supabase
          .from('users')
          .select('id, usn, image_count')
          .in('usn', usns);
        
        const datasetUserMap = new Map(datasetUsers?.map(u => [u.usn, u]));
        
        const enrichedData = data.map(role => {
          const profile = profileMap.get(role.user_id);
          return {
            ...role,
            profile,
            datasetUser: profile?.usn ? datasetUserMap.get(profile.usn) || null : null,
          };
        });
        
        setRoles(enrichedData as UserRole[]);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load user roles');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (roleId: string, userId: string, userName: string) => {
    setRemoving(roleId);
    try {
      // Call edge function to delete user completely
      const { data, error } = await supabase.functions.invoke('delete-user-complete', {
        body: { userId }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`${userName} and all associated data deleted successfully`);
      fetchRoles();
      onRoleRemoved?.();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast.error(error.message || 'Failed to delete user');
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
                    
                    <div className="flex items-center gap-1">
                      {/* Face capture status and action */}
                      {userRole.datasetUser ? (
                        userRole.datasetUser.image_count === 0 ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onCaptureFace?.(
                              userRole.datasetUser!.id,
                              userRole.datasetUser!.usn,
                              userRole.profile?.name || 'User'
                            )}
                            className="text-amber-600 border-amber-200 hover:bg-amber-50"
                          >
                            <Camera className="h-4 w-4 mr-1" />
                            Capture Face
                          </Button>
                        ) : (
                          <Badge variant="secondary" className="text-xs bg-green-100 text-green-700 border-green-200">
                            {userRole.datasetUser.image_count} images
                          </Badge>
                        )
                      ) : userRole.profile?.usn ? (
                        <Badge variant="secondary" className="text-xs bg-muted text-muted-foreground">
                          <ImageOff className="h-3 w-3 mr-1" />
                          No dataset
                        </Badge>
                      ) : null}
                      
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
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete <strong>{userRole.profile?.name}</strong>? 
                              This will permanently remove the user, their login credentials, face data, 
                              and all associated records. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(userRole.id, userRole.user_id, userRole.profile?.name || 'User')}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete User
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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