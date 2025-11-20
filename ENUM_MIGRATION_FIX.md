# Enum Migration Fix Guide

## Problem
The error `invalid input value for enum app_role: "admin"` occurs because:
1. The `app_role` enum initially only has: `customer`, `retailer`, `wholesaler`
2. New migrations try to check for `role = 'admin'` in RLS policies
3. PostgreSQL can't cast the string `'admin'` to the enum because that value doesn't exist yet

## Solution

### Option 1: Apply via Supabase Dashboard (RECOMMENDED)

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the content of: `supabase/migrations/20251120115900_add_admin_moderator_roles.sql`
4. Click **Run** to execute the migration
5. Verify it worked by running:
   ```sql
   SELECT enumlabel FROM pg_enum 
   WHERE enumtypid = 'app_role'::regtype 
   ORDER BY enumsortorder;
   ```
   You should see: `customer`, `retailer`, `wholesaler`, `admin`, `moderator`, `analyst`

6. Now you can apply the remaining migrations via CLI:
   ```bash
   supabase db push
   ```

### Option 2: Apply via CLI (if local database)

If you're running migrations against a local Supabase instance:

```bash
# Reset local database to start fresh
supabase db reset

# This will apply all migrations in order, including the enum fix
```

### Option 3: Manual SQL Execution

If neither option works, manually execute this SQL in your database:

```sql
-- Check and add 'admin' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'admin' AND enumtypid = 'app_role'::regtype) THEN
        EXECUTE 'ALTER TYPE app_role ADD VALUE ''admin''';
    END IF;
END $$;

-- Check and add 'moderator' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'moderator' AND enumtypid = 'app_role'::regtype) THEN
        EXECUTE 'ALTER TYPE app_role ADD VALUE ''moderator''';
    END IF;
END $$;

-- Check and add 'analyst' if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'analyst' AND enumtypid = 'app_role'::regtype) THEN
        EXECUTE 'ALTER TYPE app_role ADD VALUE ''analyst''';
    END IF;
END $$;
```

## Migration Order

The migrations MUST be applied in this order:

1. ✅ `20251120115900` - Add enum values (admin, moderator, analyst)
2. ✅ `20251120120000` - A/B experiments (uses admin role)
3. ✅ `20251120130000` - Rate limiting (uses admin/moderator roles)
4. ✅ `20251120140000` - Privacy/GDPR (uses admin/analyst roles)
5. ✅ `20251120150000` - Webhooks (uses admin role)
6. ✅ `20251120160000` - Performance optimization
7. ✅ `20251120170000` - Feature flags (uses admin role)

## Verification

After applying the enum migration, verify it worked:

```sql
-- Check enum values
SELECT enumlabel FROM pg_enum 
WHERE enumtypid = 'app_role'::regtype 
ORDER BY enumsortorder;

-- Expected output:
-- customer
-- retailer
-- wholesaler
-- admin
-- moderator
-- analyst
```

## Troubleshooting

**Error: "ALTER TYPE ... ADD VALUE cannot run inside a transaction block"**
- This means you're trying to add enum values in the same transaction as other commands
- Solution: Run the enum migration FIRST, separately from other migrations
- Use the Supabase Dashboard SQL Editor (automatically commits after execution)

**Error: "enum value already exists"**
- The migration checks for existing values, so this shouldn't happen
- If it does, the values are already added - you can proceed with other migrations

**Error: "type 'app_role' does not exist"**
- You need to run earlier migrations first
- The `app_role` enum is created in migration `20251117175931`
