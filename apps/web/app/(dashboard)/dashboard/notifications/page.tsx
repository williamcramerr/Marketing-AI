import { createClient } from '@/lib/supabase/server';
import { getUserNotifications } from '@/lib/actions/notifications';
import { NotificationsList } from './notifications-list';

export default async function NotificationsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { notifications: initialNotifications, total } = await getUserNotifications(user.id, {
    limit: 20,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">
          Stay updated on your campaigns, tasks, and approvals
        </p>
      </div>

      <NotificationsList
        userId={user.id}
        initialNotifications={initialNotifications}
        initialTotal={total}
      />
    </div>
  );
}
