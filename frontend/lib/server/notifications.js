/**
 * Store an in-app notification without making the originating user action fail.
 * Notification delivery is best effort: activity data remains authoritative.
 */
async function createNotification(db, { recipientId, actorId, type, title, message, data = {} }) {
  if (!recipientId || recipientId === actorId) return false;

  try {
    const { error } = await db.from('notifications').insert({
      user_id: recipientId,
      type,
      title,
      message,
      data,
      is_read: false,
    });

    if (!error) return true;
    console.error('[Notifications] unable to store notification:', error.message || error);
  } catch (error) {
    console.error('[Notifications] unable to store notification:', error instanceof Error ? error.message : error);
  }

  return false;
}

module.exports = { createNotification };