import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, XCircle, AlertTriangle, Shield, Play } from 'lucide-react';
import { toast } from 'sonner';

interface QualityCheck {
  id: string;
  check_type: string;
  status: string;
  usn: string | null;
  details: any;
  checked_at: string;
}

interface QualityStats {
  passed: number;
  warning: number;
  failed: number;
  total: number;
}

export function DatasetQualityCheck() {
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checks, setChecks] = useState<QualityCheck[]>([]);
  const [stats, setStats] = useState<QualityStats>({ passed: 0, warning: 0, failed: 0, total: 0 });

  useEffect(() => {
    fetchQualityChecks();
  }, []);

  const fetchQualityChecks = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('dataset_quality_checks')
        .select('*')
        .order('checked_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setChecks(data || []);

      // Calculate stats
      const passed = data?.filter(c => c.status === 'passed').length || 0;
      const warning = data?.filter(c => c.status === 'warning').length || 0;
      const failed = data?.filter(c => c.status === 'failed').length || 0;

      setStats({ passed, warning, failed, total: data?.length || 0 });
    } catch (error) {
      console.error('Error fetching quality checks:', error);
      toast.error('Failed to load quality checks');
    } finally {
      setLoading(false);
    }
  };

  const runQualityChecks = async () => {
    setChecking(true);
    try {
      // Fetch all users and their images
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, usn, name, image_count');

      if (usersError) throw usersError;

      const checksToInsert: any[] = [];

      for (const user of users || []) {
        // Check minimum images
        if (user.image_count < 5) {
          checksToInsert.push({
            check_type: 'minimum_images',
            status: user.image_count < 3 ? 'failed' : 'warning',
            usn: user.usn,
            details: {
              user_name: user.name,
              image_count: user.image_count,
              minimum_required: 5,
              message: user.image_count < 3
                ? 'Insufficient images for reliable recognition'
                : 'Below recommended minimum images',
            },
          });
        } else {
          checksToInsert.push({
            check_type: 'minimum_images',
            status: 'passed',
            usn: user.usn,
            details: {
              user_name: user.name,
              image_count: user.image_count,
            },
          });
        }

        // Fetch user's images for duplicate detection
        const { data: images, error: imagesError } = await supabase
          .from('face_images')
          .select('image_url')
          .eq('usn', user.usn);

        if (!imagesError && images) {
          // Simple duplicate detection based on URL
          const urls = images.map(img => img.image_url);
          const uniqueUrls = new Set(urls);
          
          if (urls.length !== uniqueUrls.size) {
            checksToInsert.push({
              check_type: 'duplicate_detection',
              status: 'warning',
              usn: user.usn,
              details: {
                user_name: user.name,
                total_images: urls.length,
                unique_images: uniqueUrls.size,
                duplicates_found: urls.length - uniqueUrls.size,
              },
            });
          }
        }
      }

      // Insert all checks
      if (checksToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('dataset_quality_checks')
          .insert(checksToInsert);

        if (insertError) throw insertError;
      }

      toast.success(`Quality checks completed. Found ${checksToInsert.length} issues.`);
      fetchQualityChecks();
    } catch (error: any) {
      console.error('Error running quality checks:', error);
      toast.error('Failed to run quality checks');
    } finally {
      setChecking(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'passed':
        return <Badge variant="outline" className="text-green-600">Passed</Badge>;
      case 'warning':
        return <Badge variant="outline" className="text-yellow-600">Warning</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dataset Quality</CardTitle>
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Dataset Quality
            </CardTitle>
            <CardDescription>
              Validate dataset quality before training
            </CardDescription>
          </div>
          <Button onClick={runQualityChecks} disabled={checking} size="sm">
            <Play className="mr-2 h-4 w-4" />
            {checking ? 'Checking...' : 'Run Checks'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quality Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Total Checks</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Passed</p>
            <p className="text-2xl font-bold text-green-600">{stats.passed}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Warnings</p>
            <p className="text-2xl font-bold text-yellow-600">{stats.warning}</p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Failed</p>
            <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
          </div>
        </div>

        {/* Health Score */}
        {stats.total > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Dataset Health Score</span>
              <span className="font-bold">
                {((stats.passed / stats.total) * 100).toFixed(1)}%
              </span>
            </div>
            <Progress value={(stats.passed / stats.total) * 100} />
          </div>
        )}

        {/* Recent Issues */}
        {checks.filter(c => c.status !== 'passed').length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Recent Issues</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {checks
                .filter(c => c.status !== 'passed')
                .slice(0, 10)
                .map((check) => (
                  <Alert key={check.id} variant={check.status === 'failed' ? 'destructive' : 'default'}>
                    <div className="flex items-start gap-3">
                      {getStatusIcon(check.status)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            {check.check_type.replace('_', ' ').toUpperCase()}
                          </p>
                          {getStatusBadge(check.status)}
                        </div>
                        <AlertDescription>
                          <p className="text-xs">
                            <span className="font-medium">{check.usn}</span>
                            {' - '}
                            {check.details?.message || JSON.stringify(check.details)}
                          </p>
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                ))}
            </div>
          </div>
        )}

        {checks.length === 0 && (
          <Alert>
            <AlertDescription>
              No quality checks have been run yet. Click "Run Checks" to validate your dataset.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}