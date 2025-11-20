// Types for moderation system

export type ModerationStatus = 'pending' | 'approved' | 'rejected' | 'flagged' | 'escalated';
export type ModerationActionType = 'approve' | 'reject' | 'edit' | 'escalate' | 'flag' | 'unflag';
export type AutoFlagReason = 'profanity' | 'spam' | 'duplicate' | 'low_quality' | 'suspicious_pattern';
export type EscalationType = 'legal' | 'operations' | 'compliance' | 'high_priority';

export interface AutoModerationFlag {
  flag_type: AutoFlagReason;
  confidence: number;
  detected_content?: string;
  overridden: boolean;
}

export interface ModerationQueueItem {
  queue_id: string;
  review_id: string;
  product_id: string;
  product_name: string;
  reviewer_id: string;
  reviewer_name: string;
  status: ModerationStatus;
  priority: number;
  original_rating: number;
  original_comment: string;
  current_rating: number;
  current_comment: string;
  flagged_by?: string;
  flagged_reason?: string;
  assigned_to?: string;
  auto_flags: AutoModerationFlag[];
  created_at: string;
  reviewed_at?: string;
  last_action_at?: string;
}

export interface ModerationAuditLogEntry {
  log_id: string;
  queue_item_id?: string;
  action_id?: string;
  review_id: string;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  action_type: ModerationActionType;
  action_summary: string;
  state_before?: Record<string, any>;
  state_after?: Record<string, any>;
  reason?: string;
  notes?: string;
  created_at: string;
}

export interface ModerationFilters {
  status?: ModerationStatus;
  productId?: string;
  reviewerId?: string;
  minPriority?: number;
  dateFrom?: string;
  dateTo?: string;
  minRating?: number;
  maxRating?: number;
  flaggedOnly?: boolean;
  assignedTo?: string;
}

export interface ModerationAction {
  queueItemId: string;
  action: ModerationActionType;
  reason?: string;
  notes?: string;
  newRating?: number;
  newComment?: string;
  escalationType?: EscalationType;
}

export interface BulkModerationAction {
  queueItemIds: string[];
  action: 'approve' | 'reject';
  reason?: string;
  notes?: string;
  rateLimit?: number;
}

export interface ModerationStatistics {
  total: number;
  statusCounts: Record<ModerationStatus, number>;
}

export interface AuditLogStatistics {
  total: number;
  actionCounts: Record<ModerationActionType, number>;
}
