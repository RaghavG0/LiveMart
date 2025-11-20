# Image Workers - Quick Start Guide

## Node.js Workers (No Deno Required!)

Since Deno isn't installed on your system, I've created Node.js versions of the workers that use your existing npm setup with Sharp.

## Setup

1. **Install Dependencies** (Already Done ✅)
   ```bash
   npm install sharp      # Already installed
   npm install -D tsx     # Already installed
   ```

2. **Configure Environment Variables**
   
   Copy `.env.workers` to `.env` and update with your Supabase credentials:
   ```bash
   cp .env.workers .env
   ```
   
   Then edit `.env`:
   ```env
   SUPABASE_URL=https://cdvhodymzfwdzfeltmsu.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
   UPLOAD_STORAGE_BUCKET=uploads
   ```

3. **Deploy Database Migration**
   ```bash
   supabase db push
   ```

4. **Create Storage Bucket**
   - Go to Supabase Dashboard → Storage
   - Create bucket named `uploads`
   - Set to public access

## Running Workers

### Image Optimization Worker

**Run Once** (Process pending jobs and exit):
```bash
npm run worker:image-optimization
```

**Run Continuously** (Process jobs every 60 seconds):
```bash
IMAGE_OPTIMIZATION_CONTINUOUS=true npm run worker:image-optimization
```

**Custom Interval** (Process every 30 seconds):
```bash
IMAGE_OPTIMIZATION_CONTINUOUS=true IMAGE_OPTIMIZATION_INTERVAL_MS=30000 npm run worker:image-optimization
```

### Image Cleanup Worker

**Run Once** (Clean up old images and exit):
```bash
npm run worker:image-cleanup
```

**Run Continuously** (Check every 24 hours):
```bash
IMAGE_CLEANUP_CONTINUOUS=true npm run worker:image-cleanup
```

**Custom Interval** (Check every 1 hour):
```bash
IMAGE_CLEANUP_CONTINUOUS=true IMAGE_CLEANUP_INTERVAL_MS=3600000 npm run worker:image-cleanup
```

## Worker Files

- **Node.js versions** (Use these!):
  - `workers/image_optimization_worker.node.ts` - Production ready with Sharp
  - `workers/image_cleanup_worker.node.ts` - Production ready

- **Deno versions** (For future use when Deno is installed):
  - `workers/image_optimization_worker.ts`
  - `workers/image_cleanup_worker.ts`

## Testing

1. **Test Upload Flow**:
   - Start your React app: `npm run dev`
   - Navigate to feedback form
   - Upload an image
   - Check `image_uploads` table in Supabase

2. **Test Optimization**:
   ```bash
   # Run worker once
   npm run worker:image-optimization
   
   # Check results in Supabase
   # Query: SELECT * FROM image_uploads WHERE processing_status = 'completed';
   ```

3. **Test Cleanup**:
   ```bash
   # Create test unreferenced image (via UI, don't link to review)
   # Wait or adjust cleanup_days_threshold in config
   
   # Run cleanup
   npm run worker:image-cleanup
   ```

## Production Deployment

### Option 1: PM2 (Process Manager)

```bash
# Install PM2
npm install -g pm2

# Start optimization worker
pm2 start npm --name "image-optimization" -- run worker:image-optimization -- IMAGE_OPTIMIZATION_CONTINUOUS=true

# Start cleanup worker
pm2 start npm --name "image-cleanup" -- run worker:image-cleanup -- IMAGE_CLEANUP_CONTINUOUS=true

# Save and auto-restart on reboot
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY workers/ ./workers/
COPY .env .env

CMD ["npm", "run", "worker:image-optimization"]
```

### Option 3: Systemd Service

Create `/etc/systemd/system/image-optimization.service`:
```ini
[Unit]
Description=Image Optimization Worker
After=network.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/path/to/live-mart-connect
Environment=IMAGE_OPTIMIZATION_CONTINUOUS=true
ExecStart=/usr/bin/npm run worker:image-optimization
Restart=always

[Install]
WantedBy=multi-user.target
```

## Monitoring

### Check Worker Status (PM2)
```bash
pm2 list
pm2 logs image-optimization
pm2 monit
```

### Check Database Status
```sql
-- Check pending jobs
SELECT COUNT(*) FROM image_optimization_queue;

-- Check processing status
SELECT 
  processing_status,
  COUNT(*) as count
FROM image_uploads
GROUP BY processing_status;

-- Check failed jobs
SELECT 
  iu.original_filename,
  ioq.retry_count,
  ioq.error_message
FROM image_optimization_queue ioq
JOIN image_uploads iu ON iu.id = ioq.image_id
WHERE ioq.retry_count > 0;
```

## Troubleshooting

### Worker won't start
- Check `.env` file has correct credentials
- Verify Sharp is installed: `npm list sharp`
- Check Node.js version: `node --version` (needs 16+)

### Images not processing
- Check `image_optimization_queue` table has jobs
- Verify worker has storage access
- Check worker logs for errors
- Ensure storage bucket exists and is public

### Sharp errors on macOS
If you see Sharp library errors:
```bash
npm rebuild sharp
```

## Configuration

Adjust settings in Supabase:
```sql
-- Increase max file size to 10MB
UPDATE image_upload_config SET value = '10' WHERE key = 'max_file_size_mb';

-- Change thumbnail size
UPDATE image_upload_config SET value = '{"width":300,"height":300}' WHERE key = 'thumbnail_dimensions';

-- Adjust cleanup threshold to 3 days
UPDATE image_upload_config SET value = '3' WHERE key = 'cleanup_days_threshold';
```

## Next Steps

1. ✅ Workers are ready to run
2. 🔲 Deploy database migration: `supabase db push`
3. 🔲 Create storage bucket in Supabase Dashboard
4. 🔲 Configure `.env` with service role key
5. 🔲 Test workers: `npm run worker:image-optimization`
6. 🔲 Deploy to production (PM2/Docker/Systemd)

---

**Note**: The Node.js workers use the exact same Sharp library that's in your React app, so they're production-ready immediately!
