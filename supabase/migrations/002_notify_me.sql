-- ============================================================
-- SpareHub — Notify Me Feature Migration
-- Adds phone number to profiles and stock notification system
-- ============================================================

-- 1. Add phone column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';

-- 2. Stock Notifications table (customer wants to be notified when part is restocked)
CREATE TABLE IF NOT EXISTS stock_notifications (
  id SERIAL PRIMARY KEY,
  part_id INT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at TIMESTAMPTZ,
  UNIQUE(part_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stock_notif_part ON stock_notifications(part_id);
CREATE INDEX IF NOT EXISTS idx_stock_notif_user ON stock_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_notif_pending ON stock_notifications(part_id) WHERE notified = false;

-- Enable RLS
ALTER TABLE stock_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_notifications
-- Authenticated users can subscribe themselves
CREATE POLICY "Users can subscribe to notifications"
  ON stock_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON stock_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all subscriptions (to send notifications)
CREATE POLICY "Admins can view all subscriptions"
  ON stock_notifications FOR SELECT
  USING (is_admin());

-- Admins can update subscriptions (mark as notified)
CREATE POLICY "Admins can update subscriptions"
  ON stock_notifications FOR UPDATE
  USING (is_admin());

-- Users can delete their own subscriptions (unsubscribe)
CREATE POLICY "Users can unsubscribe"
  ON stock_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Update the handle_new_user trigger to include phone
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    COALESCE(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
