export interface UserNotificationPreferences {
  user_id: string;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  push_opt_in: boolean;
  quiet_hours_start: string | null; // HH:MM:SS
  quiet_hours_end: string | null;
  preferred_language: string;
  updated_at: string;
}

export interface NotificationItem {
  id: string;
  event_type: string;
  delivery_status: string;
  unread: boolean;
  delivered_at: string;
  payload: Record<string, any>;
}

export interface InboxResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}
