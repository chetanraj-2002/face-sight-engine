import { Outlet, Link, useLocation } from 'react-router-dom';
import { Database, GraduationCap, Brain, UserCheck, LayoutDashboard, LogOut, Building2, Building, Users, Activity, FolderSync, FileSearch, Smartphone, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './ui/button';
import { useState } from 'react';

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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = getNavigationForRole(profile?.role);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-full items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground hidden sm:inline">Face Recognition</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {profile && (
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {profile.name}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar Overlay - Click anywhere to close */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-20 bg-background/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside 
          className={cn(
            "fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-64 border-r bg-background shadow-lg",
            "transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0"
          )}
        >
          <nav className="flex flex-col h-full p-3">
            <div className="flex-1 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all duration-150',
                      isActive
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
            
            {/* User info at bottom */}
            {profile && (
              <div className="border-t pt-3 mt-3">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                  {profile.role && (
                    <p className="text-xs text-muted-foreground capitalize">
                      {profile.role.replace('_', ' ')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-h-[calc(100vh-3.5rem)]">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
