# 🎯 Live Mart Connect - Quick Reference

## Project Summary
**Type**: Full-stack E-commerce Marketplace  
**Frontend**: React + TypeScript + Vite  
**Backend**: Supabase (PostgreSQL + Edge Functions)  
**Deployment**: Vercel (Frontend) + Supabase Cloud (Backend)

---

## 📁 Project Structure

```
live-mart-connect/
├── src/
│   ├── components/          # Reusable React components
│   │   ├── dashboards/      # Role-based dashboards
│   │   ├── feedback/        # Review system components
│   │   ├── products/        # Product-related components
│   │   └── ui/              # shadcn/ui components
│   ├── pages/               # Route pages
│   │   ├── Index.tsx        # Landing/Dashboard router
│   │   ├── Auth.tsx         # Login/Signup
│   │   ├── Cart.tsx         # Shopping cart
│   │   ├── Orders.tsx       # Order history
│   │   ├── OrderTracking.tsx # Real-time tracking
│   │   └── ProductDetail.tsx # Product page
│   ├── hooks/               # Custom React hooks
│   │   ├── useRealtimeOrder.tsx
│   │   └── useRealtimeOrders.tsx
│   ├── integrations/
│   │   └── supabase/        # Supabase client & types
│   ├── lib/                 # Utilities
│   └── main.tsx             # App entry point
├── supabase/
│   ├── functions/           # Edge functions (Deno)
│   │   ├── confirm-delivery/
│   │   ├── submit-feedback/
│   │   ├── update-order-status/
│   │   └── ... (7 total)
│   └── migrations/          # Database migrations (20 files)
├── public/                  # Static assets
├── .env                     # Environment variables
├── package.json             # Dependencies
├── vite.config.ts           # Vite configuration
└── tailwind.config.ts       # Tailwind CSS config
```

---

## 🎭 User Roles & Features

### 👤 Customer
- Browse & search products
- Location-based discovery
- Add to cart/wishlist
- Place orders
- Track deliveries (real-time)
- Review products
- View order history

### 🏪 Retailer
- Manage inventory
- Process orders
- Update order status
- View sales analytics
- Respond to reviews
- Real-time notifications

### 🏭 Wholesaler
- Bulk listings
- B2B order management
- Advanced analytics
- Inventory tracking

---

## 🗄️ Key Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profile info |
| `user_roles` | Role assignments (multi-role) |
| `products` | Product catalog |
| `orders` | Customer orders |
| `order_items` | Order line items |
| `cart_items` | Shopping cart |
| `wishlist_items` | Saved products |
| `reviews` | Product ratings & comments |
| `order_status_history` | Audit trail |
| `delivery_confirmation_tokens` | Secure delivery |

---

## 🚀 Run Locally

```bash
# Navigate to project
cd /Users/raghavgulati/Desktop/oop/live-mart-connect

# Install dependencies
npm install

# Start dev server
npm run dev

# Open browser
# http://localhost:8080
```

---

## 🌐 Deploy to Vercel

### Option 1: Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Import GitHub repository
3. Add environment variables from `.env`
4. Click Deploy

### Option 2: Vercel CLI
```bash
# Install CLI
npm i -g vercel

# Deploy
vercel --prod
```

---

## 🔧 Deploy Edge Functions (Supabase)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase

# Login
supabase login

# Link project
supabase link --project-ref cdvhodymzfwdzfeltmsu

# Deploy all functions
supabase functions deploy

# Deploy single function
supabase functions deploy confirm-delivery
```

---

## 🔐 Environment Variables

Copy to Vercel:
```env
VITE_SUPABASE_PROJECT_ID=cdvhodymzfwdzfeltmsu
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNkdmhvZHltemZ3ZHpmZWx0bXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MDAwMTksImV4cCI6MjA3ODk3NjAxOX0.asI9upCQ8JHJN87Wd8mB1tcatV0JEQhD7zHalWsD3-s
VITE_SUPABASE_URL=https://cdvhodymzfwdzfeltmsu.supabase.co
VITE_OLA_MAPS_API_KEY=2kEm7boqcXthYxk8nzob5u4F2XG6TPw59sVjYzAZ
```

---

## 🔌 Key API Endpoints

### Edge Functions
```
POST /functions/v1/submit-feedback        # Submit review
GET  /functions/v1/get-product-feedback   # Get reviews
POST /functions/v1/update-order-status    # Update order
GET  /functions/v1/confirm-delivery       # Confirm delivery
POST /functions/v1/assign-user-role       # Assign role
```

### Supabase REST
```typescript
// Auto-generated REST API for all tables
await supabase.from('products').select('*')
await supabase.from('orders').insert(...)
await supabase.from('cart_items').delete()
```

---

## 🔄 Real-time Features

### WebSocket Subscriptions
- **Order Updates**: Live status changes
- **Notifications**: Instant alerts
- **Connection Status**: Online/offline indicators

### Implementation
```typescript
// Single order subscription
const { order, loading, isConnected } = useRealtimeOrder(orderId)

// All user orders subscription
const { orders, loading, isConnected } = useRealtimeOrders(userId)
```

---

## 🎨 UI Tech Stack

- **Components**: shadcn/ui (Radix UI)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **Toasts**: Sonner
- **Maps**: Ola Maps SDK
- **Charts**: Recharts

---

## 📦 NPM Scripts

```bash
npm run dev          # Development server
npm run build        # Production build
npm run preview      # Preview build
npm run lint         # ESLint check
```

---

## 🧪 Testing Flow

1. **Sign up** → Select role
2. **Customer**: Browse → Add to cart → Checkout → Track order
3. **Retailer**: Add product → Manage orders → Update status
4. **Review**: Delivered order → Leave review
5. **Real-time**: Open two browsers → Update order → See instant sync

---

## 🐛 Common Issues & Fixes

| Issue | Solution |
|-------|----------|
| Build fails | Check Node 18+, verify env vars |
| Supabase errors | Verify API keys, check RLS policies |
| Real-time not working | Check WebSocket in DevTools, verify auth |
| Location not working | Enable browser location, check API key |

---

## 📚 Documentation Files

- `DEPLOYMENT_GUIDE.md` - Full deployment guide
- `MODULE_5_API_DOCUMENTATION.md` - API reference
- `MODULE_5_FEEDBACK_SYSTEM_COMPLETE_GUIDE.md` - Review system
- `MODULE_5_REALTIME_IMPLEMENTATION.md` - WebSocket guide
- `MODULE_5_FRONTEND_IMPLEMENTATION_SUMMARY.md` - Frontend docs
- `README.md` - Original project README

---

## 🔗 Important Links

- **Supabase Dashboard**: https://supabase.com/dashboard/project/cdvhodymzfwdzfeltmsu
- **Lovable Project**: https://lovable.dev/projects/d0294f60-e10f-453d-aee8-584e9072f8c9
- **Vercel**: https://vercel.com
- **GitHub Repo**: https://github.com/tamarylin/live-mart-connect

---

## ⚡ Quick Deploy Checklist

- [ ] Code pushed to GitHub
- [ ] Environment variables ready
- [ ] Vercel project created
- [ ] Env vars added to Vercel
- [ ] Deploy clicked
- [ ] Supabase auth URLs updated with Vercel domain
- [ ] Test authentication flow
- [ ] Test real-time features
- [ ] Test payments (if integrated)

---

**Status**: ✅ Ready for Production
