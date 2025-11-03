import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

export default function Bootstrap() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [created, setCreated] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string; emailSent: boolean } | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
  });

  const handleReset = async () => {
    if (!confirm('This will delete ALL existing super admins. Are you sure?')) {
      return;
    }

    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('reset-bootstrap');
      
      if (error) throw error;

      toast.success('Reset successful! You can now create a new super admin.');
    } catch (error: any) {
      console.error('Error resetting:', error);
      toast.error(error.message || 'Failed to reset');
    } finally {
      setResetting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('bootstrap-super-admin', {
        body: {
          email: formData.email,
          name: formData.name,
        },
      });

      if (error) throw error;

      setCredentials({
        email: data.email,
        password: data.password,
        emailSent: data.emailSent
      });
      setCreated(true);
      
      if (data.emailSent) {
        toast.success('Super admin created! Credentials shown below and sent to email.');
      } else {
        toast.warning('Super admin created! Email failed to send - save credentials shown below.');
      }
    } catch (error: any) {
      console.error('Error creating super admin:', error);
      toast.error(error.message || 'Failed to create super admin');
    } finally {
      setLoading(false);
    }
  };

  if (created && credentials) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-6">
              <div className="text-center">
                <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
                <h2 className="text-2xl font-bold">Super Admin Created!</h2>
              </div>

              <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4">
                <p className="text-sm font-semibold text-destructive mb-2">⚠️ IMPORTANT - Save These Credentials Now!</p>
                <p className="text-xs text-muted-foreground">
                  This is the only time you'll see this password. Copy it now before leaving this page.
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={credentials.email} readOnly className="font-mono text-sm" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.email);
                        toast.success('Email copied!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Password</Label>
                  <div className="flex gap-2 mt-1">
                    <Input value={credentials.password} readOnly className="font-mono text-sm" />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(credentials.password);
                        toast.success('Password copied!');
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              </div>

              {credentials.emailSent ? (
                <div className="bg-primary/10 border border-primary/50 rounded-lg p-3 text-sm text-center">
                  ✓ Credentials also sent to {credentials.email}
                </div>
              ) : (
                <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-3 text-sm text-center">
                  ⚠️ Email failed to send - make sure to copy credentials above
                </div>
              )}

              <Button 
                onClick={() => navigate('/auth')} 
                className="w-full"
              >
                Go to Login
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <Shield className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl text-center">Bootstrap Super Admin</CardTitle>
          <CardDescription className="text-center">
            Create the first super administrator account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="admin@institution.edu"
                required
              />
            </div>

            <div className="bg-muted p-4 rounded-lg text-sm text-muted-foreground">
              <p className="font-semibold mb-2">Note:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>This page can only be used once</li>
                <li>Login credentials will be sent to the provided email</li>
                <li>You'll be redirected to the login page</li>
              </ul>
            </div>

            <Button type="submit" disabled={loading || resetting} className="w-full">
              <Shield className="mr-2 h-4 w-4" />
              {loading ? 'Creating...' : 'Create Super Admin'}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          <Button 
            type="button" 
            variant="destructive" 
            onClick={handleReset} 
            disabled={loading || resetting}
            className="w-full"
          >
            {resetting ? 'Resetting...' : 'Reset & Delete Existing Super Admins'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
