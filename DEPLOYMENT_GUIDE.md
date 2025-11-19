# 🚀 Live Mart Connect - Complete Deployment Guide

## 📋 Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Database Schema](#database-schema)
5. [Running Locally](#running-locally)
6. [Deployment - Frontend (Vercel)](#deployment---frontend-vercel)
7. [Deployment - Backend (Supabase)](#deployment---backend-supabase)
8. [Environment Variables](#environment-variables)
9. [Features](#features)
10. [API Endpoints](#api-endpoints)

---

## 📝 Project Overview

**Live Mart Connect** is a full-stack e-commerce marketplace platform that connects customers, retailers, and wholesalers. It features real-time order tracking, location-based services, product reviews, and role-based dashboards.

### Key Features:
- 🛒 Multi-role platform (Customer, Retailer, Wholesaler)
- 📍 Location-based product discovery using Ola Maps
- 🔄 Real-time order updates via WebSockets
- ⭐ Product review and feedback system
- 📦 Order management and tracking
- 💳 Multiple payment methods
- 🚚 Delivery confirmation system
- 📊 Analytics dashboards for sellers

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│     (React + TypeScript + Vite)                 │
│     Deployed on: Vercel                         │
└───────────────┬─────────────────────────────────┘
                │
                │ REST API + WebSockets
                │
┌───────────────▼─────────────────────────────────┐
│              Backend (BaaS)                      │
│            Supabase Platform                     │
│  ┌──────────────────────────────────────────┐  │
│  │  PostgreSQL Database (with RLS)          │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Edge Functions (Deno Runtime)           │  │
│  │  - submit-feedback                       │  │
│  │  - confirm-delivery                      │  │
│  │  - update-order-status                   │  │
│  │  - get-product-feedback                  │  │
│  │  - generate-delivery-token               │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Realtime (WebSocket Server)             │  │
│  └──────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────┐  │
│  │  Authentication (JWT)                    │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **Routing**: React Router DOM v6
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form + Zod
- **Maps**: Ola Maps Web SDK
- **Notifications**: Sonner (Toast)

### Backend (Supabase)
- **Database**: PostgreSQL 15+ with Row Level Security (RLS)
- **Authentication**: Supabase Auth (JWT)
- **Real-time**: Supabase Realtime (WebSockets)
- **Edge Functions**: Deno 1.37+ (serverless functions)
- **Storage**: Supabase Storage (for images)

### Deployment
- **Frontend**: Vercel (CDN + Edge Network)
- **Backend**: Supabase Cloud (fully managed)

---

## 🗄️ Database Schema

### Core Tables

#### 1. **profiles**
Stores user profile information
```sql
- id (uuid, PK, FK to auth.users)
- full_name (text)
- phone (text)
- avatar_url (text)
- location_address (text)
- location_lat (decimal)
- location_lng (decimal)
- created_at, updated_at (timestamp)
```

#### 2. **user_roles**
Multi-role support (one user can have multiple roles)
```sql
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- role (enum: 'customer', 'retailer', 'wholesaler')
- created_at (timestamp)
- UNIQUE(user_id, role)
```

#### 3. **categories**
Product categories
```sql
- id (uuid, PK)
- name (text, unique)
- description (text)
- image_url (text)
- created_at (timestamp)
```

#### 4. **products**
Product listings by retailers/wholesalers
```sql
- id (uuid, PK)
- seller_id (uuid, FK to auth.users)
- category_id (uuid, FK to categories)
- name (text)
- description (text)
- price (decimal)
- stock_quantity (integer)
- image_url (text)
- is_available (boolean)
- availability_date (date)
- created_at, updated_at (timestamp)
```

#### 5. **orders**
Customer orders
```sql
- id (uuid, PK)
- customer_id (uuid, FK to auth.users)
- total_amount (decimal)
- status (enum: 'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
- delivery_address (text)
- delivery_lat, delivery_lng (decimal)
- payment_method (text)
- payment_status (text)
- notes (text)
- created_at, updated_at (timestamp)
```

#### 6. **order_items**
Items within each order
```sql
- id (uuid, PK)
- order_id (uuid, FK to orders)
- product_id (uuid, FK to products)
- quantity (integer)
- price_at_purchase (decimal)
- created_at (timestamp)
```

#### 7. **cart_items**
Shopping cart
```sql
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- product_id (uuid, FK to products)
- quantity (integer)
- created_at (timestamp)
- UNIQUE(user_id, product_id)
```

#### 8. **wishlist_items**
Saved items
```sql
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- product_id (uuid, FK to products)
- created_at (timestamp)
- UNIQUE(user_id, product_id)
```

#### 9. **reviews**
Product reviews and ratings
```sql
- id (uuid, PK)
- user_id (uuid, FK to auth.users)
- product_id (uuid, FK to products)
- order_id (uuid, FK to orders)
- rating (integer, 1-5)
- comment (text)
- created_at (timestamp)
- edited_at (timestamp)
- UNIQUE(user_id, product_id, order_id)
```

#### 10. **order_status_history**
Audit trail for order status changes
```sql
- id (uuid, PK)
- order_id (uuid, FK to orders)
- old_status (order_status)
- new_status (order_status)
- changed_by (uuid, FK to auth.users)
- changed_by_role (app_role)
- notes (text)
- created_at (timestamp)
```

#### 11. **delivery_confirmation_tokens**
Secure delivery confirmation
```sql
- id (uuid, PK)
- order_id (uuid, FK to orders, unique)
- token (text, unique)
- expires_at (timestamp)
- used (boolean)
- used_at (timestamp)
- created_at (timestamp)
```

---

## 🏃 Running Locally

### Prerequisites
- Node.js 18+ and npm
- Git
- Supabase account (free tier works)
- Ola Maps API key (optional, for location features)

### Step 1: Clone Repository
```bash
cd /Users/raghavgulati/Desktop/oop/live-mart-connect
# Repository already cloned
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
The project already has a `.env` file with Supabase credentials. Review and update if needed:

```bash
cat .env
```

Expected content:
```env
VITE_SUPABASE_PROJECT_ID="cdvhodymzfwdzfeltmsu"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOi..."
VITE_SUPABASE_URL="https://cdvhodymzfwdzfeltmsu.supabase.co"
VITE_OLA_MAPS_API_KEY="2kEm7boq..."
```

### Step 4: Start Development Server
```bash
npm run dev
```

The app will be available at: **http://localhost:8080**

### Step 5: Access the Application
1. Open browser to `http://localhost:8080`
2. Sign up for a new account
3. Select your role (Customer/Retailer/Wholesaler)
4. Start exploring!

---

## 🌐 Deployment - Frontend (Vercel)

### Method 1: Via Vercel Dashboard (Recommended)

1. **Push to GitHub** (if not already):
   ```bash
   cd /Users/raghavgulati/Desktop/oop/live-mart-connect
   git add .
   git commit -m "Ready for deployment"
   git push origin main
   ```

2. **Import to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your `live-mart-connect` repository
   - Vercel will auto-detect Vite configuration

3. **Configure Environment Variables**:
   In Vercel dashboard, add these variables:
   ```
   VITE_SUPABASE_PROJECT_ID=cdvhodymzfwdzfeltmsu
   VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOi...
   VITE_SUPABASE_URL=https://cdvhodymzfwdzfeltmsu.supabase.co
   VITE_OLA_MAPS_API_KEY=2kEm7boq...
   ```

4. **Deploy**:
   - Click "Deploy"
   - Wait 2-3 minutes
   - Your app will be live at `https://your-project.vercel.app`

### Method 2: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Follow prompts to link project
# Production deployment
vercel --prod
```

### Build Configuration
Vercel will automatically detect these settings:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`
- **Framework**: Vite

### Post-Deployment
1. Update Supabase project settings to allow your Vercel domain
2. Go to Supabase Dashboard → Authentication → URL Configuration
3. Add your Vercel URL to "Site URL" and "Redirect URLs"

---

## 🔧 Deployment - Backend (Supabase)

### The backend is already configured and running! ✅

Your Supabase project is live at:
- **Project**: `cdvhodymzfwdzfeltmsu`
- **URL**: `https://cdvhodymzfwdzfeltmsu.supabase.co`

### Deploying Edge Functions (if needed)

If you need to update or deploy edge functions:

1. **Install Supabase CLI**:
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link Project**:
   ```bash
   cd /Users/raghavgulati/Desktop/oop/live-mart-connect
   supabase link --project-ref cdvhodymzfwdzfeltmsu
   ```

4. **Deploy All Functions**:
   ```bash
   supabase functions deploy
   ```

5. **Deploy Single Function**:
   ```bash
   supabase functions deploy confirm-delivery
   ```

### Available Edge Functions:
- `assign-user-role` - Assigns roles to users
- `confirm-delivery` - Confirms order delivery
- `generate-delivery-token` - Generates secure delivery tokens
- `get-product-feedback` - Fetches product reviews
- `get-retailer-feedback` - Gets seller feedback summary
- `submit-feedback` - Submits/updates product reviews
- `update-order-status` - Updates order status (sellers only)

---

## 🔐 Environment Variables

### Frontend (.env)
```env
# Supabase Configuration
VITE_SUPABASE_PROJECT_ID=cdvhodymzfwdzfeltmsu
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_URL=https://cdvhodymzfwdzfeltmsu.supabase.co

# Ola Maps (for location features)
VITE_OLA_MAPS_API_KEY=2kEm7boqcXthYxk8nzob5u4F2XG6TPw59sVjYzAZ
```

### Backend (Supabase Edge Functions)
These are automatically injected by Supabase:
```env
SUPABASE_URL=https://cdvhodymzfwdzfeltmsu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-key>
SUPABASE_ANON_KEY=<anon-key>
```

---

## ✨ Features

### For Customers
- 🔍 Browse products by category
- 📍 Find nearby products using location
- 🛒 Add items to cart
- ❤️ Save items to wishlist
- 💳 Checkout with multiple payment options
- 📦 Track orders in real-time
- ⭐ Review purchased products
- 👤 Manage profile and location

### For Retailers
- 📦 Manage product inventory
- 📊 View sales analytics
- 🔔 Real-time order notifications
- 📋 Process and fulfill orders
- 📈 Track business performance
- ⭐ View customer feedback
- 🚚 Update order status

### For Wholesalers
- 🏭 Bulk product listings
- 📊 Advanced analytics dashboard
- 🔔 Wholesale order management
- 💼 B2B order processing
- 📈 Sales trends and insights

### Real-time Features
- 🔄 Live order status updates (WebSockets)
- 🔔 Instant notifications
- 📊 Real-time inventory updates
- 💬 Connection status indicators

---

## 🔌 API Endpoints

### Edge Functions (Serverless)

#### 1. Submit Feedback
**Endpoint**: `POST /functions/v1/submit-feedback`

**Body**:
```json
{
  "product_id": "uuid",
  "order_id": "uuid",
  "rating": 5,
  "comment": "Great product!"
}
```

**Response**:
```json
{
  "success": true,
  "review_id": "uuid"
}
```

#### 2. Get Product Feedback
**Endpoint**: `GET /functions/v1/get-product-feedback?product_id={uuid}&page=1&limit=10`

**Response**:
```json
{
  "reviews": [...],
  "average_rating": 4.5,
  "total_reviews": 42,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total_pages": 5
  }
}
```

#### 3. Confirm Delivery
**Endpoint**: `GET /functions/v1/confirm-delivery?token={token}`

**Response**:
```json
{
  "success": true,
  "order_id": "uuid",
  "message": "Delivery confirmed"
}
```

#### 4. Update Order Status
**Endpoint**: `POST /functions/v1/update-order-status`

**Headers**: `Authorization: Bearer <JWT>`

**Body**:
```json
{
  "order_id": "uuid",
  "new_status": "shipped",
  "notes": "Package shipped via FedEx"
}
```

**Response**:
```json
{
  "success": true,
  "order_id": "uuid",
  "old_status": "processing",
  "new_status": "shipped"
}
```

### REST API (Supabase Client)

All standard CRUD operations use Supabase's auto-generated REST API:

```typescript
import { supabase } from '@/integrations/supabase/client'

// Fetch products
const { data, error } = await supabase
  .from('products')
  .select('*')
  .eq('is_available', true)

// Insert order
const { data, error } = await supabase
  .from('orders')
  .insert({
    customer_id: userId,
    total_amount: 100,
    status: 'pending'
  })
```

---

## 🚀 Quick Start Commands

```bash
# Development
npm run dev              # Start dev server (localhost:8080)
npm run build            # Build for production
npm run preview          # Preview production build

# Linting
npm run lint             # Check code quality

# Deployment
vercel                   # Deploy to Vercel (staging)
vercel --prod            # Deploy to production

# Supabase
supabase login           # Login to Supabase CLI
supabase link            # Link to project
supabase functions deploy # Deploy edge functions
```

---

## 📚 Additional Resources

### Documentation Files in Repo:
- `MODULE_5_API_DOCUMENTATION.md` - Complete API reference
- `MODULE_5_FEEDBACK_SYSTEM_COMPLETE_GUIDE.md` - Review system guide
- `MODULE_5_FRONTEND_IMPLEMENTATION_SUMMARY.md` - Frontend components
- `MODULE_5_REALTIME_IMPLEMENTATION.md` - WebSocket implementation
- `MODULE_5_SELLER_DASHBOARDS_IMPLEMENTATION.md` - Dashboard features
- `MODULE_5_DELIVERY_CONFIRMATION_IMPLEMENTATION.md` - Delivery system

### External Links:
- [Supabase Docs](https://supabase.com/docs)
- [Vite Docs](https://vitejs.dev/)
- [Vercel Docs](https://vercel.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [TanStack Query](https://tanstack.com/query/latest)

---

## 🐛 Troubleshooting

### Common Issues:

**1. Build fails on Vercel**
- Ensure all environment variables are set
- Check Node.js version (use 18+)
- Verify `package.json` scripts

**2. Supabase connection errors**
- Verify API keys in `.env`
- Check Supabase project is active
- Ensure RLS policies are configured

**3. Real-time not working**
- Check WebSocket connection in browser DevTools
- Verify Supabase Realtime is enabled in project settings
- Check user authentication state

**4. Location features not working**
- Verify Ola Maps API key
- Check browser location permissions
- Ensure HTTPS in production

---

## 📞 Support

For issues or questions:
1. Check existing documentation files
2. Review Supabase project logs
3. Check browser console for errors
4. Review network tab for API failures

---

**✨ Your Live Mart Connect platform is ready to deploy!**
