import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState({
    email_absent_notifications: true,
    email_training_complete: true,
    email_system_updates: true,
  });
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences({
          email_absent_notifications: data.email_absent_notifications,
          email_training_complete: data.email_training_complete,
          email_system_updates: data.email_system_updates,
        });
      }
    } catch (error: any) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: string, value: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('notification_preferences')
        .upsert({
          user_id: user.id,
          [key]: value,
        });

      if (error) throw error;

      setPreferences(prev => ({ ...prev, [key]: value }));
      
      toast({
        title: 'Preferences Updated',
        description: 'Your notification preferences have been saved',
      });
    } catch (error: any) {
      toast({
        title: 'Update Failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <CardTitle>Notification Preferences</CardTitle>
        </div>
        <CardDescription>Manage your email notification settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="absent">Absence Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive emails when marked absent
            </p>
          </div>
          <Switch
            id="absent"
            checked={preferences.email_absent_notifications}
            onCheckedChange={(checked) => updatePreference('email_absent_notifications', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="training">Training Completion</Label>
            <p className="text-sm text-muted-foreground">
              Get notified when model training completes
            </p>
          </div>
          <Switch
            id="training"
            checked={preferences.email_training_complete}
            onCheckedChange={(checked) => updatePreference('email_training_complete', checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="system">System Updates</Label>
            <p className="text-sm text-muted-foreground">
              Receive important system announcements
            </p>
          </div>
          <Switch
            id="system"
            checked={preferences.email_system_updates}
            onCheckedChange={(checked) => updatePreference('email_system_updates', checked)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
