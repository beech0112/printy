import { supabase } from '@/lib/supabase';

export interface ChatEndServiceOptions {
  sessionId: string;
  userId: string;
  userType: 'customer' | 'admin';
  conversationId?: string;
  endMessage?: string;
}

/**
 * ChatEndService
 * Handles ending chat sessions. The insertMessage call has been removed
 * pending the new AI pipeline message API.
 */
export class ChatEndService {
  static async endChatSession(
    options: ChatEndServiceOptions
  ): Promise<{ success: boolean; error?: string }> {
    const { sessionId, userType } = options;

    try {
      const { data: session, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('status, metadata')
        .eq('id', sessionId)
        .single();

      if (sessionError) {
        console.error('Failed to fetch session:', sessionError);
        return { success: false, error: 'Failed to fetch session' };
      }

      if (session.status === 'ended') {
        return { success: true };
      }

      const { error: updateError } = await supabase
        .from('chat_sessions')
        .update({
          status: 'ended',
          ended_at: new Date().toISOString(),
          metadata: {
            ...session.metadata,
            ended_by: userType,
          },
        })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Failed to update session status:', updateError);
        return { success: false, error: 'Failed to update session status' };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in endChatSession:', error);
      return { success: false, error: 'Unexpected error occurred' };
    }
  }

  static async isSessionEnded(sessionId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from('chat_sessions')
        .select('status')
        .eq('id', sessionId)
        .single();

      return data?.status === 'ended';
    } catch (error) {
      console.error('Error checking session status:', error);
      return false;
    }
  }
}
