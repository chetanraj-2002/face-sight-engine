import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Building2, Building, Users, GraduationCap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface RoleHierarchyProps {
  currentRole?: string;
}

export function RoleHierarchy({ currentRole }: RoleHierarchyProps) {
  const hierarchy = [
    {
      role: 'super_admin',
      label: 'Super Admin',
      icon: Shield,
      description: 'Full system access',
      canManage: ['institute_admin'],
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      role: 'institute_admin',
      label: 'Institute Admin',
      icon: Building2,
      description: 'Manages departments',
      canManage: ['department_admin'],
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      role: 'department_admin',
      label: 'Department Admin',
      icon: Building,
      description: 'Manages faculty & students',
      canManage: ['faculty', 'student'],
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      role: 'faculty',
      label: 'Faculty',
      icon: Users,
      description: 'Teaches and monitors attendance',
      canManage: [],
      color: 'text-orange-500',
      bgColor: 'bg-orange-500/10',
    },
    {
      role: 'student',
      label: 'Student',
      icon: GraduationCap,
      description: 'Views attendance',
      canManage: [],
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Role Hierarchy
        </CardTitle>
        <CardDescription>
          Understanding the role structure and permissions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {hierarchy.map((level, index) => {
            const Icon = level.icon;
            const isCurrentRole = currentRole === level.role;
            
            return (
              <div key={level.role} className="relative">
                <div
                  className={`rounded-lg border p-4 transition-all ${
                    isCurrentRole
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`rounded-full p-2 ${level.bgColor}`}>
                      <Icon className={`h-5 w-5 ${level.color}`} />
                    </div>
                    
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{level.label}</h3>
                        {isCurrentRole && (
                          <Badge variant="default" className="text-xs">
                            Your Role
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground">
                        {level.description}
                      </p>
                      
                      {level.canManage.length > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Can assign:</span>
                          <div className="flex gap-1">
                            {level.canManage.map((managedRole) => (
                              <Badge key={managedRole} variant="outline" className="text-xs">
                                {managedRole.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Connection line to next level */}
                {index < hierarchy.length - 1 && (
                  <div className="ml-6 h-4 w-0.5 bg-border" />
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}