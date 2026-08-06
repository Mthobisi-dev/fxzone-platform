import sqlite3

def purge_unwanted_users():
    conn = sqlite3.connect('backend/fxzone.db')
    cur = conn.cursor()
    cur.execute("""
        DELETE FROM users 
        WHERE username IN ('trader_bob', 'google_trader', 'bob_trader') 
           OR display_name LIKE '%Bob Trader%' 
           OR display_name LIKE '%Google Trader%'
    """)
    conn.commit()
    print(f"Purged {cur.rowcount} users from SQLite database.")
    conn.close()

if __name__ == '__main__':
    purge_unwanted_users()
