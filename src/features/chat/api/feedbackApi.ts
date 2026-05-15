/**
 * API functions for chat session feedback
 *
 * chat_session_feedback table has been removed. These are no-ops.
 */

import type {
  ChatSessionFeedback,
  SubmitFeedbackParams,
  SessionFeedbackState,
} from '../types/feedback';

export async function submitSessionFeedback(
  _params: SubmitFeedbackParams
): Promise<ChatSessionFeedback | null> {
  return null;
}

export async function getSessionFeedback(
  _sessionId: string
): Promise<SessionFeedbackState | null> {
  return { isSubmitted: false, rating: null, submittedAt: null };
}
