#!/bin/bash
# Script to apply the enum migration separately
# This ensures the enum values exist before other migrations try to use them

echo "Applying enum migration to add admin, moderator, analyst roles..."
echo "This must be done separately due to PostgreSQL enum transaction restrictions"
echo ""

# Run just the enum migration
supabase db push --include-all --dry-run

echo ""
echo "To apply this migration, run:"
echo "  supabase db push"
echo ""
echo "Or manually execute the migration in Supabase Dashboard SQL Editor:"
echo "  supabase/migrations/20251120115900_add_admin_moderator_roles.sql"
