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
  const [created, setCreated] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    name: '',
  });

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

      setCreated(true);
      toast.success(`Super admin created! Check ${formData.email} for login credentials.`);
      
      setTimeout(() => {
        navigate('/auth');
      }, 3000);
    } catch (error: any) {
      console.error('Error creating super admin:', error);
      toast.error(error.message || 'Failed to create super admin');
    } finally {
      setLoading(false);
    }
  };

  if (created) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Shield className="h-16 w-16 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">Super Admin Created!</h2>
              <p className="text-muted-foreground">
                Login credentials have been sent to {formData.email}
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to login page...
              </p>
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

            <Button type="submit" disabled={loading} className="w-full">
              <Shield className="mr-2 h-4 w-4" />
              {loading ? 'Creating...' : 'Create Super Admin'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
