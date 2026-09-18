import os
import urllib.request
import json

def purge_bot_followers():
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
        # Fetch bot user IDs from Supabase
        req = urllib.request.Request(
            f"{supabase_url}/rest/v1/users?select=id,username&role=eq.bot",
            headers=headers
        )
        with urllib.request.urlopen(req) as response:
            bots = json.loads(response.read().decode())
            bot_ids = [b["id"] for b in bots]

        if bot_ids:
            for bot_id in bot_ids:
                # Delete follows where following_id is bot
                del_req = urllib.request.Request(
                    f"{supabase_url}/rest/v1/follows?following_id=eq.{bot_id}",
                    headers=headers,
                    method="DELETE"
                )
                urllib.request.urlopen(del_req)
            print(f"Purged follow records for {len(bot_ids)} bot accounts on Supabase.")
        else:
            print("No bot accounts found on Supabase.")
    except Exception as e:
        print(f"Error purging bot followers: {e}")

if __name__ == '__main__':
    purge_bot_followers()
