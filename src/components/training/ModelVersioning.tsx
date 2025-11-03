import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { supabase } from '@/integrations/supabase/client';
import { GitBranch, Rocket, RotateCcw, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ModelVersion {
  id: string;
  version: string;
  is_active: boolean;
  is_production: boolean;
  accuracy: number | null;
  users_count: number | null;
  embeddings_count: number | null;
  created_at: string;
  deployed_at: string | null;
  deprecated_at: string | null;
}

export function ModelVersioning() {
  const [loading, setLoading] = useState(true);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [deploying, setDeploying] = useState<string | null>(null);

  useEffect(() => {
    fetchVersions();
  }, []);

  const fetchVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('model_versions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVersions(data || []);
    } catch (error) {
      console.error('Error fetching model versions:', error);
      toast.error('Failed to load model versions');
    } finally {
      setLoading(false);
    }
  };

  const deployVersion = async (versionId: string, version: string) => {
    setDeploying(versionId);
    try {
      // First, set all versions to not production
      const { error: updateError } = await supabase
        .from('model_versions')
        .update({ is_production: false })
        .neq('id', versionId);

      if (updateError) throw updateError;

      // Then set the selected version to production
      const { error: deployError } = await supabase
        .from('model_versions')
        .update({
          is_production: true,
          is_active: true,
          deployed_at: new Date().toISOString(),
        })
        .eq('id', versionId);

      if (deployError) throw deployError;

      toast.success(`Model version ${version} deployed to production`);
      fetchVersions();
    } catch (error: any) {
      console.error('Error deploying version:', error);
      toast.error('Failed to deploy model version');
    } finally {
      setDeploying(null);
    }
  };

  const rollbackVersion = async (versionId: string, version: string) => {
    setDeploying(versionId);
    try {
      // Set all current production versions to not production
      const { error: updateError } = await supabase
        .from('model_versions')
        .update({ is_production: false })
        .eq('is_production', true);

      if (updateError) throw updateError;

      // Set the selected version to production
      const { error: rollbackError } = await supabase
        .from('model_versions')
        .update({
          is_production: true,
          is_active: true,
          deployed_at: new Date().toISOString(),
        })
        .eq('id', versionId);

      if (rollbackError) throw rollbackError;

      toast.success(`Rolled back to model version ${version}`);
      fetchVersions();
    } catch (error: any) {
      console.error('Error rolling back version:', error);
      toast.error('Failed to rollback model version');
    } finally {
      setDeploying(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Model Versions</CardTitle>
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
          <GitBranch className="h-5 w-5" />
          Model Versions
        </CardTitle>
        <CardDescription>
          Manage and deploy model versions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <GitBranch className="h-12 w-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">No model versions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Train a model to create the first version
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Version</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Accuracy</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow key={version.id}>
                  <TableCell className="font-mono">{version.version}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {version.is_production && (
                        <Badge variant="default">
                          <Rocket className="mr-1 h-3 w-3" />
                          Production
                        </Badge>
                      )}
                      {version.is_active && !version.is_production && (
                        <Badge variant="secondary">Active</Badge>
                      )}
                      {version.deprecated_at && (
                        <Badge variant="outline">Deprecated</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {version.accuracy ? (
                      <span className="text-green-600 font-medium">
                        {(version.accuracy * 100).toFixed(2)}%
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{version.users_count || '-'}</TableCell>
                  <TableCell>
                    {format(new Date(version.created_at), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {!version.is_production && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deploying === version.id}
                            >
                              <Rocket className="mr-1 h-3 w-3" />
                              Deploy
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Deploy Model Version</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to deploy version {version.version} to production?
                                This will replace the current production model.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deployVersion(version.id, version.version)}
                              >
                                Deploy to Production
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      {version.is_production && (
                        <Badge variant="default">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Current
                        </Badge>
                      )}
                      {!version.is_production && version.deprecated_at === null && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={deploying === version.id}
                            >
                              <RotateCcw className="mr-1 h-3 w-3" />
                              Rollback
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Rollback to Previous Version</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to rollback to version {version.version}?
                                This will immediately replace the production model.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => rollbackVersion(version.id, version.version)}
                                className="bg-yellow-600 hover:bg-yellow-700"
                              >
                                Rollback
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}