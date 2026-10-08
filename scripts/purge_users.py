import os
import json
import urllib.request
import argparse

DEMO_USERNAMES = (
    "trader_bob",
    "google_trader",
    "bob_trader",
    "blog_demo_taylor",
    "blog_demo_alex",
    "blog_demo_jamie",
)


def purge_unwanted_users(confirm: bool):
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    print(f"Target Supabase project: {supabase_url}")
    print(f"Target usernames: {', '.join(DEMO_USERNAMES)}")
    if not confirm:
        print("Dry run only. Re-run with --confirm to permanently delete only these Auth accounts.")
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    try:
        for username in DEMO_USERNAMES:
            lookup = urllib.request.Request(
                f"{supabase_url}/rest/v1/users?select=id,username&username=eq.{username}",
                headers=headers,
            )
            with urllib.request.urlopen(lookup) as response:
                accounts = json.loads(response.read().decode())

            for account in accounts:
                user_id = account.get("id")
                if not user_id:
                    continue
                # Delete the Auth identity, not only its public profile. This
                # revokes refresh sessions and lets the profile cascade through
                # the foreign key instead of leaving a sign-in-capable account.
                request = urllib.request.Request(
                    f"{supabase_url}/auth/v1/admin/users/{user_id}",
                    headers=headers,
                    method="DELETE"
                )
                urllib.request.urlopen(request)
                print(f"Deleted demo account: {username}")
        print("Finished removing listed demo accounts.")
    except Exception as e:
        raise RuntimeError("Unable to purge users") from e

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Delete the explicitly listed legacy demo accounts.")
    parser.add_argument('--confirm', action='store_true', help='Perform deletion instead of the default dry run.')
    purge_unwanted_users(parser.parse_args().confirm)
