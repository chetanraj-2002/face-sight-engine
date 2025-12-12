import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { UserDetailsList } from '@/components/user';

export default function UserDirectory() {
  const { profile } = useAuth();

  if (!profile || profile.role !== 'department_admin') {
    return (
      <div className="p-10">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Access denied. Only department admins can view user directory.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-10">
      <div>
        <h1 className="text-3xl font-bold">User Directory</h1>
        <p className="text-muted-foreground mt-2">
          View students section-wise and faculty members
        </p>
      </div>

      <UserDetailsList />
    </div>
  );
}