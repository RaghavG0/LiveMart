# Quick Deploy: Image Upload System

Since the Supabase CLI migration sync is having issues, you can deploy directly via the Supabase Dashboard SQL Editor.

## Steps to Deploy

### 1. Open Supabase SQL Editor
1. Go to https://supabase.com/dashboard
2. Select your project (`cdvhodymzfwdzfeltmsu`)
3. Click **SQL Editor** in the left sidebar
4. Click **New query**

### 2. Copy and Paste Migration SQL
Copy the entire contents of this file:
```
supabase/migrations/20251120100000_image_upload_system.sql
```

### 3. Run the Migration
1. Paste the SQL into the editor
2. Click **Run** (or press Cmd+Enter)
3. Wait for completion (~5-10 seconds)
4. You should see "Success. No rows returned"

### 4. Verify Installation

Run this query to verify:
```sql
-- Check if tables exist
SELECT 
  'image_uploads' as table_name, 
  COUNT(*) as column_count 
FROM information_schema.columns 
WHERE table_name = 'image_uploads'
UNION ALL
SELECT 
  'image_optimization_queue', 
  COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'image_optimization_queue'
UNION ALL
SELECT 
  'image_upload_config', 
  COUNT(*) 
FROM information_schema.columns 
WHERE table_name = 'image_upload_config';

-- Check if functions exist
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%image%' 
  AND routine_schema = 'public';
```

Expected output:
- `image_uploads`: 23 columns
- `image_optimization_queue`: 7 columns  
- `image_upload_config`: 3 columns
- Functions: 7 functions with 'image' in the name

### 5. Create Storage Bucket

After migration succeeds:

1. Go to **Storage** in Supabase Dashboard
2. Click **New bucket**
3. Name: `uploads`
4. **Public bucket**: ✅ Enabled
5. Click **Create bucket**

### 6. Set Storage Policies

In the SQL Editor, run:
```sql
-- Allow authenticated users to upload to their own folder
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Users can upload to own folder',
  'uploads',
  '(bucket_id = ''uploads''::text) AND (auth.uid() = (storage.foldername(name))[2]::uuid)'
);

-- Allow public to read all images
INSERT INTO storage.policies (name, bucket_id, definition)
VALUES (
  'Public can view all images',
  'uploads',
  'bucket_id = ''uploads''::text'
);
```

### 7. Test the Worker

Now your worker should work:

```bash
export SUPABASE_URL=https://cdvhodymzfwdzfeltmsu.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your_actual_key
export UPLOAD_STORAGE_BUCKET=uploads

# Test Deno worker (if Deno installed)
deno run -A workers/image_optimization_worker.ts

# OR use Node.js worker
npm run worker:image-optimization
```

Expected output:
```
Image Optimization Worker started
Storage bucket: uploads
Running once
No pending jobs
```

## Alternative: Use psql directly

If you have psql installed:

```bash
# Get your database URL from Supabase Dashboard → Project Settings → Database
# Format: postgresql://postgres:[password]@[host]/postgres

psql "postgresql://postgres:your_password@db.cdvhodymzfwdzfeltmsu.supabase.co:5432/postgres" \
  -f supabase/migrations/20251120100000_image_upload_system.sql
```

## Troubleshooting

### "function already exists"
If you see errors about existing functions, it means the migration was already partially applied. That's okay - the worker should work now.

### "relation already exists"  
Same as above - tables already exist. Check with the verification query.

### Worker still says "function not found"
1. Verify the function exists:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'get_pending_optimization_jobs';
```

2. If it doesn't exist, re-run just the function part from the migration.

---

**Once deployed, you're ready to upload images!** 🎉

The system will:
1. Accept uploads from your React app
2. Store in Supabase Storage
3. Queue for optimization
4. Generate thumbnail, compressed, and WebP variants
5. Clean up unreferenced images after 7 days
