// Rate Limiting & Spam Protection Middleware
// Apply to all feedback-related edge functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface RateLimitResult {
  allowed: boolean;
  message: string;
  retryAfter?: number;
  requestsRemaining?: number;
  requiresCaptcha?: boolean;
  captchaToken?: string;
}

export class RateLimiter {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Check rate limit for request
   */
  async checkLimit(
    userId: string | null,
    ipAddress: string,
    endpoint: string,
    userAgent?: string
  ): Promise<RateLimitResult> {
    try {
      const { data, error } = await this.supabase.rpc('check_rate_limit', {
        p_user_id: userId,
        p_ip_address: ipAddress,
        p_endpoint: endpoint
      });

      if (error) throw error;

      // Check if CAPTCHA required
      if (!data.allowed && userId) {
        const captcha = await this.checkCaptchaRequired(userId, ipAddress, endpoint);
        if (captcha.required) {
          return {
            allowed: false,
            message: 'CAPTCHA verification required',
            requiresCaptcha: true,
            captchaToken: captcha.token
          };
        }
      }

      return {
        allowed: data.allowed,
        message: data.message,
        retryAfter: data.retry_after,
        requestsRemaining: data.requests_remaining
      };
    } catch (error: any) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow request if rate limit check fails
      return { allowed: true, message: 'OK' };
    }
  }

  /**
   * Check if CAPTCHA is required
   */
  private async checkCaptchaRequired(
    userId: string,
    ipAddress: string,
    endpoint: string
  ): Promise<{ required: boolean; token?: string }> {
    const { data, error } = await this.supabase
      .from('captcha_challenges')
      .select('challenge_token, expires_at')
      .eq('user_id', userId)
      .eq('is_solved', false)
      .gte('expires_at', new Date().toISOString())
      .order('required_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('CAPTCHA check failed:', error);
      return { required: false };
    }

    return {
      required: data !== null,
      token: data?.challenge_token
    };
  }

  /**
   * Verify CAPTCHA solution
   */
  async verifyCaptcha(
    challengeToken: string,
    response: string,
    captchaType: string = 'recaptcha_v3'
  ): Promise<{ success: boolean; score?: number }> {
    // Verify with external CAPTCHA service
    const secretKey = Deno.env.get(`${captchaType.toUpperCase()}_SECRET_KEY`);
    
    if (!secretKey) {
      console.error('CAPTCHA secret key not configured');
      return { success: false };
    }

    try {
      // reCAPTCHA v3 verification
      if (captchaType === 'recaptcha_v3') {
        const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
        const verifyResponse = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: secretKey,
            response: response
          })
        });

        const result = await verifyResponse.json();

        if (result.success) {
          // Update challenge as solved
          await this.supabase
            .from('captcha_challenges')
            .update({
              is_solved: true,
              solved_at: new Date().toISOString(),
              score: result.score
            })
            .eq('challenge_token', challengeToken);

          return { success: true, score: result.score };
        }
      }

      // hCaptcha verification
      if (captchaType === 'hcaptcha') {
        const verifyUrl = 'https://hcaptcha.com/siteverify';
        const verifyResponse = await fetch(verifyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: secretKey,
            response: response
          })
        });

        const result = await verifyResponse.json();

        if (result.success) {
          await this.supabase
            .from('captcha_challenges')
            .update({
              is_solved: true,
              solved_at: new Date().toISOString()
            })
            .eq('challenge_token', challengeToken);

          return { success: true };
        }
      }

      return { success: false };
    } catch (error) {
      console.error('CAPTCHA verification failed:', error);
      return { success: false };
    }
  }
}

export class SpamDetector {
  private supabase: any;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Detect duplicate content
   */
  async detectDuplicate(
    userId: string,
    content: string,
    contentType: string = 'review'
  ): Promise<{ isDuplicate: boolean; isBlocked: boolean; duplicateCount: number }> {
    try {
      const { data, error } = await this.supabase.rpc('detect_duplicate_content', {
        p_user_id: userId,
        p_content: content,
        p_content_type: contentType
      });

      if (error) throw error;

      return {
        isDuplicate: data.is_duplicate,
        isBlocked: data.is_blocked,
        duplicateCount: data.duplicate_count
      };
    } catch (error) {
      console.error('Duplicate detection failed:', error);
      return { isDuplicate: false, isBlocked: false, duplicateCount: 0 };
    }
  }

  /**
   * Detect suspicious patterns
   */
  async detectSuspiciousPatterns(
    userId: string,
    action: string,
    context: Record<string, any>
  ): Promise<{ isSuspicious: boolean; patterns: string[]; severity: string }> {
    const patterns: string[] = [];
    let highestSeverity = 'low';

    try {
      // Check rapid posting (multiple reviews in short time)
      if (action === 'review_submitted') {
        const { data: recentReviews } = await this.supabase
          .from('reviews')
          .select('id, created_at')
          .eq('user_id', userId)
          .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

        if (recentReviews && recentReviews.length >= 5) {
          patterns.push('rapid_posting');
          highestSeverity = 'medium';

          // Log suspicious activity
          await this.supabase.from('suspicious_activity_log').insert({
            user_id: userId,
            pattern_type: 'rapid_posting',
            severity: 'medium',
            detection_rule: 'five_reviews_in_five_minutes',
            pattern_details: { count: recentReviews.length, timeframe_minutes: 5 }
          });
        }
      }

      // Check abnormal rating patterns (all 1-star or all 5-star)
      const { data: userReviews } = await this.supabase
        .from('reviews')
        .select('rating')
        .eq('user_id', userId)
        .limit(10);

      if (userReviews && userReviews.length >= 5) {
        const allSame = userReviews.every(r => r.rating === userReviews[0].rating);
        const allExtremes = userReviews.every(r => r.rating === 1 || r.rating === 5);

        if (allSame || allExtremes) {
          patterns.push('abnormal_rating_pattern');
          highestSeverity = 'medium';

          await this.supabase.from('suspicious_activity_log').insert({
            user_id: userId,
            pattern_type: 'abnormal_rating_pattern',
            severity: 'medium',
            detection_rule: allSame ? 'all_same_rating' : 'all_extreme_ratings',
            pattern_details: { ratings: userReviews.map(r => r.rating) }
          });
        }
      }

      // Check for coordinated attacks (multiple users, same IP, similar content)
      // This would require more complex analysis...

      return {
        isSuspicious: patterns.length > 0,
        patterns,
        severity: highestSeverity
      };
    } catch (error) {
      console.error('Pattern detection failed:', error);
      return { isSuspicious: false, patterns: [], severity: 'low' };
    }
  }

  /**
   * Check user reputation
   */
  async checkReputation(userId: string): Promise<{
    trustScore: number;
    isSuspended: boolean;
    isTrusted: boolean;
    suspendedUntil?: string;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('user_reputation')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return { trustScore: 50, isSuspended: false, isTrusted: false };
      }

      return {
        trustScore: data.trust_score,
        isSuspended: data.is_suspended,
        isTrusted: data.is_trusted,
        suspendedUntil: data.suspended_until
      };
    } catch (error) {
      console.error('Reputation check failed:', error);
      return { trustScore: 50, isSuspended: false, isTrusted: false };
    }
  }

  /**
   * Update reputation based on event
   */
  async updateReputation(
    userId: string,
    eventType: string,
    eventData: Record<string, any> = {}
  ): Promise<void> {
    try {
      await this.supabase.rpc('update_user_reputation', {
        p_user_id: userId,
        p_event_type: eventType,
        p_event_data: eventData
      });
    } catch (error) {
      console.error('Reputation update failed:', error);
    }
  }
}

/**
 * Middleware function to apply rate limiting and spam protection
 */
export async function protectEndpoint(
  req: Request,
  userId: string | null,
  endpoint: string
): Promise<{ allowed: boolean; response?: Response }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const rateLimiter = new RateLimiter(supabaseUrl, supabaseKey);
  const spamDetector = new SpamDetector(supabaseUrl, supabaseKey);

  // Extract IP address
  const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                   req.headers.get('x-real-ip') || 
                   '0.0.0.0';

  const userAgent = req.headers.get('user-agent') || '';

  // 1. Check rate limit
  const rateLimit = await rateLimiter.checkLimit(userId, ipAddress, endpoint, userAgent);

  if (!rateLimit.allowed) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-RateLimit-Remaining': (rateLimit.requestsRemaining || 0).toString()
    };

    if (rateLimit.retryAfter) {
      headers['Retry-After'] = rateLimit.retryAfter.toString();
    }

    if (rateLimit.requiresCaptcha) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            success: false,
            error: 'CAPTCHA_REQUIRED',
            message: rateLimit.message,
            captcha_token: rateLimit.captchaToken
          }),
          { status: 429, headers }
        )
      };
    }

    return {
      allowed: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: 'RATE_LIMIT_EXCEEDED',
          message: rateLimit.message,
          retry_after: rateLimit.retryAfter
        }),
        { status: 429, headers }
      )
    };
  }

  // 2. Check user reputation (if authenticated)
  if (userId) {
    const reputation = await spamDetector.checkReputation(userId);

    if (reputation.isSuspended) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            success: false,
            error: 'USER_SUSPENDED',
            message: 'Your account has been suspended due to policy violations',
            suspended_until: reputation.suspendedUntil
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      };
    }

    // Low trust score - require CAPTCHA
    if (reputation.trustScore < 30 && endpoint.includes('submit')) {
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            success: false,
            error: 'VERIFICATION_REQUIRED',
            message: 'Additional verification required',
            trust_score: reputation.trustScore
          }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      };
    }
  }

  return { allowed: true };
}

/**
 * Apply spam detection to content before submission
 */
export async function validateContent(
  userId: string,
  content: string,
  contentType: string = 'review'
): Promise<{ valid: boolean; reason?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const spamDetector = new SpamDetector(supabaseUrl, supabaseKey);

  // 1. Check duplicate content
  const duplicate = await spamDetector.detectDuplicate(userId, content, contentType);

  if (duplicate.isBlocked) {
    return {
      valid: false,
      reason: 'Duplicate or spam content detected'
    };
  }

  // 2. Check suspicious patterns
  const patterns = await spamDetector.detectSuspiciousPatterns(userId, `${contentType}_submitted`, {
    content_length: content.length
  });

  if (patterns.isSuspicious && patterns.severity === 'high') {
    return {
      valid: false,
      reason: `Suspicious activity detected: ${patterns.patterns.join(', ')}`
    };
  }

  // 3. Basic content validation
  const trimmed = content.trim();

  if (trimmed.length < 10) {
    return { valid: false, reason: 'Content too short' };
  }

  if (trimmed.length > 5000) {
    return { valid: false, reason: 'Content too long' };
  }

  // Check for excessive repeated characters
  const repeatedPattern = /(.)\1{10,}/;
  if (repeatedPattern.test(trimmed)) {
    return { valid: false, reason: 'Invalid content format' };
  }

  return { valid: true };
}
