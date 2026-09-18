export interface SocialUser {
  id: string;
  username: string;
  display_name: string;
  displayName?: string;
  avatar_url: string | null;
  avatarUrl?: string | null;
  bio: string | null;
  role: string;
  followers_count: number;
  followersCount?: number;
  following_count: number;
  followingCount?: number;
  is_following: boolean;
  isFollowing?: boolean;
  is_follower?: boolean;
  is_mutual?: boolean;
  created_at?: string;
}
