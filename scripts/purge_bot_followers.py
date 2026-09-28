import os
import urllib.request
import json
import argparse

def purge_bot_followers(confirm: bool):
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    print(f"Target Supabase project: {supabase_url}")
    if not confirm:
        print("Dry run only. Re-run with --confirm to delete bot follower records.")
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
        raise RuntimeError("Unable to purge bot followers") from e

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Remove follower rows targeting bot profiles.")
    parser.add_argument('--confirm', action='store_true', help='Perform deletion instead of the default dry run.')
    purge_bot_followers(parser.parse_args().confirm)
