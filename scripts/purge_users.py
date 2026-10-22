import os
import json
import urllib.request
import argparse
from urllib.parse import quote

DEMO_USERNAMES = (
    "trader_bob",
    "google_trader",
    "bob_trader",
    "blog_demo_taylor",
    "blog_demo_alex",
    "blog_demo_jamie",
)


def purge_unwanted_users(confirm: bool, usernames=(), emails=(), display_names=(), include_demo=False):
    supabase_url = os.environ.get("SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not service_key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.")

    print(f"Target Supabase project: {supabase_url}")
    targets = [("username", value) for value in usernames]
    targets += [("email", value) for value in emails]
    targets += [("display_name", value) for value in display_names]
    if include_demo:
        targets += [("username", value) for value in DEMO_USERNAMES]
    # Deletion must always be explicit.  In particular, never make a
    # production project plus a broad default list the dangerous default.
    targets = list(dict.fromkeys(targets))
    if not targets:
        print("No targets supplied. Dry run complete; nothing was changed.")
        return
    print("Target accounts:")
    for field, value in targets:
        print(f"  {field}={value}")
    if not confirm:
        print("Dry run only. Re-run with --confirm to permanently delete exactly these Auth accounts.")
        return

    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json"
    }

    try:
        resolved = set()
        for field, value in targets:
            filter_value = quote(str(value), safe='')
            lookup = urllib.request.Request(
                f"{supabase_url}/rest/v1/users?select=id,username,display_name,email&{field}=eq.{filter_value}",
                headers=headers,
            )
            with urllib.request.urlopen(lookup) as response:
                accounts = json.loads(response.read().decode())

            for account in accounts:
                user_id = account.get("id")
                if not user_id:
                    continue
                if user_id in resolved:
                    continue
                resolved.add(user_id)
                # Delete the Auth identity, not only its public profile. This
                # revokes refresh sessions and lets the profile cascade through
                # the foreign key instead of leaving a sign-in-capable account.
                request = urllib.request.Request(
                    f"{supabase_url}/auth/v1/admin/users/{user_id}",
                    headers=headers,
                    method="DELETE"
                )
                urllib.request.urlopen(request)
                print(f"Deleted account: {account.get('username') or account.get('display_name') or user_id}")
        print("Finished removing explicitly listed accounts.")
    except Exception as e:
        raise RuntimeError("Unable to purge users") from e

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Delete the explicitly listed legacy demo accounts.")
    parser.add_argument('--confirm', action='store_true', help='Perform deletion instead of the default dry run.')
    parser.add_argument('--include-demo', action='store_true', help='Include the known legacy demo usernames.')
    parser.add_argument('--username', action='append', default=[], help='Exact username to remove (repeatable).')
    parser.add_argument('--email', action='append', default=[], help='Exact email to remove (repeatable).')
    parser.add_argument('--display-name', action='append', default=[], help='Exact public display name to remove (repeatable).')
    args = parser.parse_args()
    purge_unwanted_users(args.confirm, args.username, args.email, args.display_name, args.include_demo)
