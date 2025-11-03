import { Outlet, Link, useLocation } from 'react-router-dom';
import { Database, GraduationCap, Brain, UserCheck, LayoutDashboard, LogOut, Building2, Building, Users, Activity, FolderSync, FileSearch, Smartphone, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';

const getNavigationForRole = (role: string | undefined) => {
  const baseNav = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['super_admin', 'institute_admin', 'department_admin', 'faculty', 'student'] },
  ];

  const roleSpecificNav = {
    super_admin: [
      { name: 'Institutions', href: '/institutions', icon: Building2 },
      { name: 'Reports', href: '/attendance-reports', icon: Activity },
      { name: 'Model Health', href: '/training', icon: Activity },
      { name: 'Audit Logs', href: '/audit-logs', icon: FileSearch },
    ],
    institute_admin: [
      { name: 'Departments', href: '/departments', icon: Building },
      { name: 'Reports', href: '/attendance-reports', icon: Activity },
    ],
    department_admin: [
      { name: 'User Management', href: '/users', icon: Users },
      { name: 'Dataset', href: '/dataset', icon: Database },
      { name: 'Training', href: '/training', icon: Brain },
      { name: 'Recognition', href: '/recognition', icon: GraduationCap },
      { name: 'Attendance', href: '/attendance', icon: UserCheck },
      { name: 'Reports', href: '/attendance-reports', icon: Activity },
      { name: 'Batch Operations', href: '/batch-operations', icon: FolderSync },
      { name: 'Audit Logs', href: '/audit-logs', icon: FileSearch },
    ],
    faculty: [
      { name: 'Recognition', href: '/recognition', icon: GraduationCap },
      { name: 'Attendance', href: '/attendance', icon: UserCheck },
      { name: 'Reports', href: '/attendance-reports', icon: Activity },
      { name: 'Mobile QR', href: '/mobile-attendance', icon: Smartphone },
    ],
    student: [
      { name: 'My Attendance', href: '/my-attendance', icon: UserCheck },
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  };

  const roleNav = roleSpecificNav[role as keyof typeof roleSpecificNav] || [];
  return [...baseNav, ...roleNav];
};

export default function Layout() {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const navigation = getNavigationForRole(profile?.role);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6" />
          <span className="text-xl font-bold">Face Recognition</span>
        </div>
        <div className="flex items-center gap-4">
          {profile && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">{profile.name}</span>
              {profile.role && (
                <>
                  {' • '}
                  <span className="capitalize">{profile.role.replace('_', ' ')}</span>
                </>
              )}
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      <div className="flex">
        <aside className="w-64 border-r min-h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                    location.pathname === item.href
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
