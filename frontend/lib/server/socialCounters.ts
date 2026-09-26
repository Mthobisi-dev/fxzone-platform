type QueryClient = any;

function isMissingLegacyRelation(error: any) {
  return error?.code === '42P01' || error?.code === 'PGRST204' || /relation .* does not exist|could not find.*table/i.test(error?.message || '');
}

async function countRows(query: PromiseLike<any>, optional = false) {
  const result = await query;
  if (result.error) {
    if (optional && isMissingLegacyRelation(result.error)) return 0;
    throw result.error;
  }
  return result.count || 0;
}

export async function getPostInteractionCounts(db: QueryClient, postId: string) {
  const [likes_count, comments_count, reposts_count, saves_count] = await Promise.all([
    countRows(db.from('reactions').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('reaction_type', 'like')),
    countRows(db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId)),
    countRows(db.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', postId), true),
    countRows(db.from('bookmarks').select('*', { count: 'exact', head: true }).eq('post_id', postId), true),
  ]);
  const counts = { likes_count, comments_count, reposts_count, saves_count };
  const { error: reconcileError } = await db.from('posts').update({ likes_count, comments_count, reposts_count }).eq('id', postId);
  if (reconcileError) console.warn('Could not reconcile post counters:', reconcileError.message);
  return counts;
}

export async function getFollowCounts(db: QueryClient, userId: string) {
  const [followers_count, following_count] = await Promise.all([
    countRows(db.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId)),
    countRows(db.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId)),
  ]);
  const { error } = await db.from('users').update({ followers_count, following_count }).eq('id', userId);
  if (error) console.warn('Could not reconcile follow counters:', error.message);
  return { followers_count, following_count };
}
