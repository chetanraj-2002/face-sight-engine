import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';

export default function Settings() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences
        </p>
      </div>

      <div className="max-w-2xl">
        <NotificationPreferences />
      </div>
    </div>
  );
}
