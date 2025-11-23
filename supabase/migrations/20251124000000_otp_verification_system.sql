-- =====================================================
-- OTP VERIFICATION SYSTEM FOR SIGN-UP
-- =====================================================

-- Create OTP storage table
CREATE TABLE IF NOT EXISTS public.signup_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT,
  otp_code TEXT NOT NULL,
  otp_type TEXT NOT NULL CHECK (otp_type IN ('email', 'sms')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN DEFAULT false NOT NULL,
  attempts INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_signup_otps_email ON public.signup_otps(email);
CREATE INDEX IF NOT EXISTS idx_signup_otps_phone ON public.signup_otps(phone);
CREATE INDEX IF NOT EXISTS idx_signup_otps_code ON public.signup_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_signup_otps_expires ON public.signup_otps(expires_at);
-- Index for active (unverified) OTPs - without time condition since NOW() is not IMMUTABLE
CREATE INDEX IF NOT EXISTS idx_signup_otps_active ON public.signup_otps(email, verified, expires_at) 
  WHERE verified = false;

-- Enable RLS
ALTER TABLE public.signup_otps ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert OTPs (for signup)
CREATE POLICY "Anyone can create OTPs"
  ON public.signup_otps
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Policy: Anyone can verify OTPs (for signup)
CREATE POLICY "Anyone can verify OTPs"
  ON public.signup_otps
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

-- Policy: Service role can manage all OTPs
CREATE POLICY "Service role can manage OTPs"
  ON public.signup_otps
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Function to clean up expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM public.signup_otps
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$;

-- Add comments
COMMENT ON TABLE public.signup_otps IS 'Stores OTP codes for email/SMS verification during signup';
COMMENT ON COLUMN public.signup_otps.otp_type IS 'Type of OTP: email or sms';
COMMENT ON COLUMN public.signup_otps.attempts IS 'Number of verification attempts made';
COMMENT ON COLUMN public.signup_otps.expires_at IS 'OTP expiration timestamp (typically 10 minutes from creation)';

