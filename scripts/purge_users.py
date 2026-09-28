import os
import urllib.request
import argparse

def purge_unwanted_users(confirm: bool):
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    unwanted_usernames = ["trader_bob", "google_trader", "bob_trader"]
    print(f"Target Supabase project: {supabase_url}")
    print(f"Target usernames: {', '.join(unwanted_usernames)}")
    if not confirm:
        print("Dry run only. Re-run with --confirm to delete these accounts.")
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    try:
        # Delete demo users from Supabase public.users table
        for username in unwanted_usernames:
            req = urllib.request.Request(
                f"{supabase_url}/rest/v1/users?username=eq.{username}",
                headers=headers,
                method="DELETE"
            )
            urllib.request.urlopen(req)
        print("Purged demo users from Supabase database.")
    except Exception as e:
        raise RuntimeError("Unable to purge users") from e

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Delete the explicitly listed legacy demo accounts.")
    parser.add_argument('--confirm', action='store_true', help='Perform deletion instead of the default dry run.')
    purge_unwanted_users(parser.parse_args().confirm)
