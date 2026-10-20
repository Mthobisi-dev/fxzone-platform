import type { SupabaseClient } from '@supabase/supabase-js';
import { storyAudienceIds } from '../storyAudience';

export type PostVisibilityRecord = {
  id: string;
  user_id: string;
  is_story?: boolean | null;
  expires_at?: string | null;
};

export type PostVisibilityResult =
  | { allowed: true; post: PostVisibilityRecord }
  | { allowed: false; reason: 'not_found' | 'restricted' | 'expired'; post?: PostVisibilityRecord };

/**
 * Central audience check for post reads and interactions. Stories are private
 * to their owner and mutual followers; ordinary posts remain public unless a
 * caller applies an additional product-specific rule.
 */
export async function canViewPost(
  db: SupabaseClient,
  postId: string,
  viewerId: string | null,
): Promise<PostVisibilityResult> {
  const { data: post, error } = await db
    .from('posts')
    .select('id, user_id, is_story, expires_at')
    .eq('id', postId)
    .maybeSingle();

  if (error || !post) return { allowed: false, reason: 'not_found' };
  const record = post as PostVisibilityRecord;
  if (!record.is_story) return { allowed: true, post: record };

  if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) {
    return { allowed: false, reason: 'expired', post: record };
  }
  if (!viewerId) return { allowed: false, reason: 'restricted', post: record };
  if (record.user_id === viewerId) return { allowed: true, post: record };

  const [outgoing, incoming] = await Promise.all([
    db.from('follows').select('following_id').eq('follower_id', viewerId),
    db.from('follows').select('follower_id').eq('following_id', viewerId),
  ]);
  if (outgoing.error || incoming.error) {
    throw outgoing.error || incoming.error;
  }

  const audience = storyAudienceIds(viewerId, outgoing.data || [], incoming.data || []);
  return audience.includes(record.user_id)
    ? { allowed: true, post: record }
    : { allowed: false, reason: 'restricted', post: record };
}
