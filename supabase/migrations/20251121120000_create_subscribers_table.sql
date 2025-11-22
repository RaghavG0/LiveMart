-- Create subscribers table for email newsletter subscriptions
CREATE TABLE IF NOT EXISTS public.subscribers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON public.subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_is_active ON public.subscribers(is_active) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow public read access to check subscription status (for verification)
CREATE POLICY "Anyone can check subscription status"
  ON public.subscribers FOR SELECT
  USING (true);

-- Allow service role to insert subscriptions (via edge function)
CREATE POLICY "Service role can insert subscriptions"
  ON public.subscribers FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow service role to update subscriptions
CREATE POLICY "Service role can update subscriptions"
  ON public.subscribers FOR UPDATE
  TO service_role
  USING (true);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_subscribers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_subscribers_updated_at
  BEFORE UPDATE ON public.subscribers
  FOR EACH ROW
  EXECUTE FUNCTION update_subscribers_updated_at();

-- Add comment to table
COMMENT ON TABLE public.subscribers IS 'Stores email addresses of users subscribed to LiveMart newsletter and alerts';
COMMENT ON COLUMN public.subscribers.email IS 'Unique email address of the subscriber';
COMMENT ON COLUMN public.subscribers.is_active IS 'Whether the subscriber is currently active (not unsubscribed)';
COMMENT ON COLUMN public.subscribers.unsubscribed_at IS 'Timestamp when the subscriber unsubscribed';

