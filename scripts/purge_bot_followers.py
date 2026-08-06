import sqlite3

def purge_bot_followers():
    conn = sqlite3.connect('backend/fxzone.db')
    cur = conn.cursor()
    
    # Get Bot user IDs
    cur.execute("SELECT id FROM users WHERE username IN ('fxzone_bot', 'jackbot_analyst') OR role = 'bot' OR email = 'bot@fxzone.io'")
    bot_ids = [row[0] for row in cur.fetchall()]
    
    if bot_ids:
        placeholders = ','.join('?' * len(bot_ids))
        # Delete follows pointing to bot
        cur.execute(f"DELETE FROM follows WHERE following_id IN ({placeholders})", bot_ids)
        deleted_follows = cur.rowcount
        
        # Reset followers_count for bots
        cur.execute(f"UPDATE users SET followers_count = 0 WHERE id IN ({placeholders})", bot_ids)
        conn.commit()
        print(f"Purged {deleted_follows} follow records for bot accounts and reset followers_count to 0.")
    else:
        print("No bot accounts found.")
        
    conn.close()

if __name__ == '__main__':
    purge_bot_followers()
