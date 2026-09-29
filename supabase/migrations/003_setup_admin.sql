-- ============================================================
-- SpareHub — Admin Account Setup
-- ============================================================
-- Run this in Supabase SQL Editor after signing up with admin email
-- Also go to: Authentication → Providers → Email → turn OFF "Confirm email"
-- ============================================================

-- 1. Confirm the admin user's email (skip email verification)
UPDATE auth.users
SET email_confirmed_at = now(),
    confirmation_token = '',
    raw_app_meta_data = raw_app_meta_data || '{"email_verified": true}'::jsonb
WHERE email = 'priyanshughetiya3@gmail.com';

-- 2. Promote to admin role
UPDATE profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'priyanshughetiya3@gmail.com'
);
