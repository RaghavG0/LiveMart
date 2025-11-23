-- =====================================================
-- ADD LOGIN OTP SUPPORT TO EXISTING OTP SYSTEM
-- =====================================================

-- Update the otp_type check constraint to include 'login'
ALTER TABLE public.signup_otps 
  DROP CONSTRAINT IF EXISTS signup_otps_otp_type_check;

ALTER TABLE public.signup_otps 
  ADD CONSTRAINT signup_otps_otp_type_check 
  CHECK (otp_type IN ('email', 'sms', 'login'));

-- Update comment to reflect new usage
COMMENT ON COLUMN public.signup_otps.otp_type IS 'Type of OTP: email, sms, or login';

