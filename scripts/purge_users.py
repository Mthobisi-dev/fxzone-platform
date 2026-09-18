import os
import urllib.request

def purge_unwanted_users():
    supabase_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "https://cxmvfdnckedjvfcqsiiw.supabase.co")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""))

    if not service_key:
        print("Error: SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY missing.")
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    try:
        # Delete demo users from Supabase public.users table
        unwanted_usernames = ["trader_bob", "google_trader", "bob_trader"]
        for username in unwanted_usernames:
            req = urllib.request.Request(
                f"{supabase_url}/rest/v1/users?username=eq.{username}",
                headers=headers,
                method="DELETE"
            )
            urllib.request.urlopen(req)
        print("Purged demo users from Supabase database.")
    except Exception as e:
        print(f"Error purging unwanted users: {e}")

if __name__ == '__main__':
    purge_unwanted_users()
