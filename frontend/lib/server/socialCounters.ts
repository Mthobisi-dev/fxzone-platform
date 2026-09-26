type QueryClient = any;

/** Reads interaction counts from their source rows after every mutation. */
export async function getPostInteractionCounts(db: QueryClient, postId: string) {
  const [likesResult, commentsResult, repostsResult, savesResult] = await Promise.all([
    db.from('reactions').select('*', { count: 'exact', head: true }).eq('post_id', postId).eq('reaction_type', 'like'),
    db.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    db.from('reposts').select('*', { count: 'exact', head: true }).eq('post_id', postId),
    db.from('bookmarks').select('*', { count: 'exact', head: true }).eq('post_id', postId),
  ]);
  const failed = [likesResult, commentsResult, repostsResult, savesResult].find((result: any) => result.error);
  if (failed?.error) throw failed.error;
  const counts = { likes_count: likesResult.count || 0, comments_count: commentsResult.count || 0, reposts_count: repostsResult.count || 0, saves_count: savesResult.count || 0 };
  const { error: reconcileError } = await db.from('posts').update({ likes_count: counts.likes_count, comments_count: counts.comments_count, reposts_count: counts.reposts_count }).eq('id', postId);
  if (reconcileError) console.warn('Could not reconcile post counters:', reconcileError.message);
  return counts;
}
