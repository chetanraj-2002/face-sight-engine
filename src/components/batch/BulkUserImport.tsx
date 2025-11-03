import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

export function BulkUserImport() {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();
  const { logAction } = useAuditLog();

  const downloadTemplate = () => {
    const csv = 'usn,name,class\nCS001,John Doe,CS-A\nCS002,Jane Smith,CS-A\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_users_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());
      
      if (!headers.includes('usn') || !headers.includes('name')) {
        throw new Error('CSV must contain usn and name columns');
      }

      const users = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return {
          usn: values[headers.indexOf('usn')],
          name: values[headers.indexOf('name')],
          class: values[headers.indexOf('class')] || null,
        };
      });

      console.log(`Importing ${users.length} users`);

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const user of users) {
        const { error } = await supabase
          .from('users')
          .insert(user);

        if (error) {
          failed++;
          errors.push(`${user.usn}: ${error.message}`);
        } else {
          success++;
        }
      }

      await logAction('bulk_import_users', 'users', undefined, undefined, { count: success });

      setResult({ success, failed, errors });
      
      toast({
        title: 'Import Complete',
        description: `Successfully imported ${success} users, ${failed} failed`,
        variant: failed > 0 ? 'default' : 'default',
      });
    } catch (error: any) {
      toast({
        title: 'Import Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk User Import</CardTitle>
        <CardDescription>Import multiple users from a CSV file</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadTemplate} className="gap-2">
            <Download className="h-4 w-4" />
            Download Template
          </Button>
        </div>

        <div className="space-y-2">
          <Input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
          <Button
            onClick={handleImport}
            disabled={!file || importing}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {importing ? 'Importing...' : 'Import Users'}
          </Button>
        </div>

        {result && (
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2 text-success">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">{result.success} users imported successfully</span>
            </div>
            {result.failed > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">{result.failed} users failed</span>
                </div>
                <div className="max-h-40 overflow-y-auto text-sm text-muted-foreground">
                  {result.errors.map((error, i) => (
                    <div key={i} className="py-1">• {error}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
