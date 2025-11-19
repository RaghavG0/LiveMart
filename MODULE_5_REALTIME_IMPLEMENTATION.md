# Module 5: Real-time Order Updates Implementation

## Overview
Implemented real-time order status updates using Supabase Realtime (WebSockets) to provide instant feedback to customers when order statuses change.

## Key Features Implemented

### 1. Real-time Hooks
Created reusable React hooks for managing real-time order subscriptions:

#### `useRealtimeOrder` Hook
- **Purpose**: Subscribe to updates for a single order
- **Location**: `src/hooks/useRealtimeOrder.tsx`
- **Features**:
  - Automatic reconnection with exponential backoff
  - Connection status tracking
  - Toast notifications for status changes
  - Optimistic UI updates
  - Error handling and recovery
  
**Usage Example**:
```typescript
const { order, loading, isConnected, refetch } = useRealtimeOrder(orderId, {
  showNotifications: true,
  onStatusChange: (oldStatus, newStatus) => {
    console.log(`Status changed from ${oldStatus} to ${newStatus}`);
  }
});
```

#### `useRealtimeOrders` Hook
- **Purpose**: Subscribe to all orders for a user
- **Location**: `src/hooks/useRealtimeOrders.tsx`
- **Features**:
  - Monitors INSERT, UPDATE, DELETE events
  - Automatic state synchronization
  - Real-time notifications for new orders and status changes
  - Connection status tracking
  
**Usage Example**:
```typescript
const { orders, loading, isConnected, refetch } = useRealtimeOrders(userId, {
  showNotifications: true
});
```

### 2. Updated Pages

#### OrderTracking Page (`src/pages/OrderTracking.tsx`)
**Enhancements**:
- Replaced manual subscription with `useRealtimeOrder` hook
- Added connection status indicator (Live/Offline badge with WiFi icons)
- Simplified code and improved maintainability
- Automatic reconnection on connection loss

**UI Indicators**:
- 🟢 Green "Live" badge with WiFi icon when connected
- 🔴 Gray "Offline" badge with WiFi-off icon when disconnected

#### Orders Page (`src/pages/Orders.tsx`)
**Enhancements**:
- Integrated `useRealtimeOrders` hook for all user orders
- Added connection status badge in card header
- Real-time notifications when order status changes
- Automatic review status checking for delivered orders

**Features**:
- Instant order list updates without page refresh
- Visual feedback for connection status
- Seamless review integration

## Technical Implementation

### Event Types Supported
Based on the Supabase `orders` table real-time events:

1. **order_status_changed**
   - Triggered: When order status field is updated
   - Payload: Full order object with old and new values
   - UI Action: Update status badge, show toast notification

2. **order_created**
   - Triggered: When new order is inserted
   - Payload: Full new order object
   - UI Action: Add to order list, show success notification

3. **order_deleted**
   - Triggered: When order is removed (rare)
   - Payload: Order ID
   - UI Action: Remove from list

### Security & Authorization

**Row-Level Security (RLS)**:
- All subscriptions respect existing RLS policies
- Users can only receive events for orders they own (customer_id match)
- Retailers/Wholesalers receive events for orders they manage (via product seller_id)
- JWT authentication automatically enforced by Supabase

**Channel Naming**:
- Single order: `order-{orderId}-{timestamp}` (unique per connection)
- User orders: `user-orders-{userId}`

### Connection Management

**Reconnection Strategy**:
```typescript
Exponential backoff algorithm:
- Initial retry: 1 second
- Max retry delay: 30 seconds
- Formula: Math.min(1000 * 2^retryCount, 30000)
```

**Subscription States**:
- `SUBSCRIBED`: Active connection, receiving events
- `CHANNEL_ERROR`: Connection lost, attempting reconnect
- `CLOSED`: Connection terminated

**Heartbeat/Ping**:
- Handled automatically by Supabase Realtime client
- No manual ping implementation needed

### Fallback Mechanism

**Automatic Data Refresh**:
- On reconnection, `fetchOrder()` is called to catch up on missed updates
- No polling fallback needed - Supabase Realtime is highly reliable
- For extreme cases, manual refresh available via `refetch()` function

## User Experience

### Notifications
- **Toast Notifications**: Appear in bottom-right for status changes
- **Format**: "Order status updated to: {status}" with optional notes
- **Duration**: 4 seconds (configurable via Sonner)

### Visual Indicators
1. **Status Badges**: Color-coded order status with semantic colors
2. **Connection Badge**: Shows real-time connection status
3. **Loading States**: Skeleton loaders during initial fetch
4. **Error States**: User-friendly error messages

### Performance Optimizations
- **Debounced Updates**: Prevents UI thrashing from rapid updates
- **Memoized Components**: Reduces unnecessary re-renders
- **Lazy Loading**: Orders loaded on-demand
- **Optimistic Updates**: Immediate UI feedback

## Testing Scenarios

### Manual Testing
1. **Status Change**: Update order status via seller dashboard → Customer sees instant update
2. **Reconnection**: Disable network → Re-enable → Should auto-reconnect and sync
3. **Multiple Orders**: Create multiple orders → All should appear in real-time
4. **Cross-Device**: Update on device A → Device B receives update

### Expected Behavior
- **Latency**: < 3 seconds from status change to UI update under normal network
- **Reconnection**: < 30 seconds to restore connection after network loss
- **Sync**: Zero data loss on reconnection (last 10 events caught up via refetch)

## API Integration

### Supabase Realtime Events
```typescript
supabase
  .channel('channel-name')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'orders',
    filter: 'id=eq.{orderId}'
  }, (payload) => {
    // Handle update
  })
  .subscribe()
```

### Edge Functions Used
- `update-order-status`: Called by sellers to change order status
- Status changes automatically trigger Postgres triggers
- Triggers emit real-time events via Supabase Realtime

## Future Enhancements

### Potential Additions
1. **Driver Location Tracking**: Real-time GPS coordinates
2. **Delivery Photos**: Instant photo upload on delivery
3. **ETA Updates**: Dynamic estimated delivery time
4. **Chat Messages**: Real-time order-related messaging
5. **Push Notifications**: Mobile/Browser push for offline users

### Scalability Considerations
- **Channel Limits**: Supabase supports thousands of concurrent connections
- **Rate Limiting**: Currently no rate limits on subscriptions
- **Load Testing**: Recommended for > 10,000 concurrent users

## Deployment Checklist

✅ Real-time hooks created  
✅ Order tracking page updated  
✅ Orders page updated  
✅ Connection status indicators added  
✅ Error handling implemented  
✅ Reconnection logic in place  
✅ Toast notifications working  
✅ Type safety maintained  

## Documentation References

- [Supabase Realtime Docs](https://supabase.com/docs/guides/realtime)
- [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [React Query (for fallback)](https://tanstack.com/query/latest)

## Support & Troubleshooting

### Common Issues

**Issue**: "Lost connection" message appearing frequently  
**Solution**: Check network stability, increase retry timeout

**Issue**: Events not received after reconnection  
**Solution**: `refetch()` is called automatically, but check RLS policies

**Issue**: Multiple identical notifications  
**Solution**: Each subscription should have unique channel name with timestamp

### Debug Logging
Enable verbose logging:
```typescript
console.log('Subscription status:', status);
console.log('Order updated:', payload);
```

All real-time events are logged to browser console for debugging.

---

**Implementation Date**: November 19, 2025  
**Status**: ✅ Complete  
**Next Steps**: Deploy and monitor production metrics
