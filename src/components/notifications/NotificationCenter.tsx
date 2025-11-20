import React, { useEffect, useState } from "react";
import { supabase } from "../../integrations/supabase/client";
import { NotificationItem } from "../../types/notifications";

export const NotificationCenter: React.FC = () => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function fetchInbox() {
    setLoading(true);
    setError(null);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const resp = await fetch(`${process.env.REACT_APP_SUPABASE_FUNCTION_URL}/get-inbox?limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await resp.json();
    if (!resp.ok) {
      setError(json.error || "Failed to load inbox");
      setLoading(false);
      return;
    }
    setItems(json.notifications || []);
    setUnreadCount(json.unreadCount || 0);
    setLoading(false);
  }

  useEffect(() => {
    fetchInbox();
  }, []);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const markSelectedRead = async () => {
    if (selected.size === 0) return;
    setMarking(true);
    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;
    const resp = await fetch(`${process.env.REACT_APP_SUPABASE_FUNCTION_URL}/mark-notifications-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ notificationIds: Array.from(selected) })
    });
    const json = await resp.json();
    if (!resp.ok) {
      setError(json.error || 'Failed to mark read');
    } else {
      // Update local state
      const updated = items.map(i => selected.has(i.id) ? { ...i, unread: false } : i);
      setItems(updated);
      setUnreadCount(updated.filter(i => i.unread).length);
      setSelected(new Set());
    }
    setMarking(false);
  };

  if (loading) return <div className="p-4">Loading notifications...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Notifications</h2>
        <div className="text-sm">Unread: {unreadCount}</div>
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div className="space-y-2">
        {items.length === 0 && <div className="text-sm text-gray-500">No notifications</div>}
        {items.map(n => (
          <div
            key={n.id}
            className={`border rounded p-3 flex items-start gap-3 ${n.unread ? 'bg-yellow-50' : 'bg-white'}`}
          >
            <input
              type="checkbox"
              checked={selected.has(n.id)}
              onChange={() => toggleSelect(n.id)}
              className="mt-1"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{n.event_type}</span>
                <span className="text-xs text-gray-500">{new Date(n.delivered_at).toLocaleString()}</span>
              </div>
              <div className="text-sm mt-1 text-gray-700">
                {n.payload?.message || JSON.stringify(n.payload)}
              </div>
              <div className="mt-1 text-xs text-gray-500">Status: {n.delivery_status}</div>
              {!n.unread && <div className="text-xs text-green-600">Read</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          disabled={marking || selected.size === 0}
          onClick={markSelectedRead}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {marking ? 'Marking...' : `Mark Selected Read (${selected.size})`}
        </button>
        <button
          onClick={fetchInbox}
          className="border px-4 py-2 rounded"
        >Refresh</button>
      </div>
    </div>
  );
};
