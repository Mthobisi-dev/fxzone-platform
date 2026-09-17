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

// Global server-side state stored in memory
const socialUsers: SocialUser[] = [
  {
    id: 'user-allex',
    username: 'AlexTrader',
    display_name: 'Alex Rivera',
    displayName: 'Alex Rivera',
    avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    bio: 'SMC Order Block & ICT specialist. Trading Forex majors and Tech equities.',
    role: 'verified_educator',
    followers_count: 142,
    followersCount: 142,
    following_count: 45,
    followingCount: 45,
    is_following: false,
    isFollowing: false,
    is_follower: true,
  },
  {
    id: 'user-sarah',
    username: 'SarahFX',
    display_name: 'Sarah Chen',
    displayName: 'Sarah Chen',
    avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=250&q=80',
    bio: 'Macro economic analyst focusing on EURUSD & GBPUSD central bank policy setups.',
    role: 'analyst',
    followers_count: 98,
    followersCount: 98,
    following_count: 32,
    followingCount: 32,
    is_following: true,
    isFollowing: true,
    is_follower: true,
    is_mutual: true,
  },
  {
    id: 'user-marcus',
    username: 'MarcusMacro',
    display_name: 'Marcus Vance',
    displayName: 'Marcus Vance',
    avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    bio: 'Gold & Oil momentum strategy trader. Daily ICT liquidity sweeps breakdown.',
    role: 'analyst',
    followers_count: 210,
    followersCount: 210,
    following_count: 60,
    followingCount: 60,
    is_following: false,
    isFollowing: false,
  },
  {
    id: 'user-elena',
    username: 'ElenaCrypto',
    display_name: 'Elena Rostova',
    displayName: 'Elena Rostova',
    avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    bio: 'BTC & ETH swing trading setups with 1:3+ Risk-to-Reward ratio.',
    role: 'trader',
    followers_count: 156,
    followersCount: 156,
    following_count: 50,
    followingCount: 50,
    is_following: true,
    isFollowing: true,
  },
  {
    id: 'user-david',
    username: 'DavidScalp',
    display_name: 'David K.',
    displayName: 'David K.',
    avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
    avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=250&q=80',
    bio: '1-minute & 5-minute scalper on US30 and NAS100 index futures.',
    role: 'trader',
    followers_count: 87,
    followersCount: 87,
    following_count: 20,
    followingCount: 20,
    is_following: false,
    isFollowing: false,
  },
];

export function getAllSocialUsers(query?: string, limit = 50): SocialUser[] {
  let filtered = [...socialUsers];
  if (query && query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.display_name.toLowerCase().includes(q) ||
        (u.bio && u.bio.toLowerCase().includes(q))
    );
  }
  return filtered.slice(0, limit);
}

export function findSocialUser(idOrUsername: string): SocialUser | undefined {
  if (!idOrUsername) return undefined;
  const target = idOrUsername.trim().toLowerCase();
  return socialUsers.find(
    (u) => u.id.toLowerCase() === target || u.username.toLowerCase() === target
  );
}

export function createSocialUser(data: {
  username: string;
  display_name?: string;
  role?: string;
  bio?: string;
  avatar_url?: string;
}): SocialUser {
  const cleanUsername = data.username.trim().replace(/\s+/g, '_');
  const existing = socialUsers.find(
    (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
  );
  if (existing) {
    return existing;
  }

  const id = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const newUser: SocialUser = {
    id,
    username: cleanUsername,
    display_name: data.display_name || cleanUsername,
    displayName: data.display_name || cleanUsername,
    avatar_url:
      data.avatar_url ||
      `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}`,
    avatarUrl:
      data.avatar_url ||
      `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(cleanUsername)}`,
    bio: data.bio || 'FxZone Trader & Market Analyst',
    role: data.role || 'trader',
    followers_count: 0,
    followersCount: 0,
    following_count: 0,
    followingCount: 0,
    is_following: false,
    isFollowing: false,
    created_at: new Date().toISOString(),
  };

  socialUsers.unshift(newUser);
  return newUser;
}

export function toggleFollowSocialUser(idOrUsername: string): SocialUser | undefined {
  const user = findSocialUser(idOrUsername);
  if (!user) return undefined;

  user.is_following = !user.is_following;
  user.isFollowing = user.is_following;
  if (user.is_following) {
    user.followers_count += 1;
  } else {
    user.followers_count = Math.max(0, user.followers_count - 1);
  }
  user.followersCount = user.followers_count;
  return user;
}

export function updateSocialUserProfile(
  idOrUsername: string,
  updateData: {
    username?: string;
    display_name?: string;
    bio?: string;
    avatar_url?: string;
  }
): SocialUser {
  let user = findSocialUser(idOrUsername);
  if (!user) {
    user = createSocialUser({
      username: updateData.username || idOrUsername,
      display_name: updateData.display_name,
      bio: updateData.bio,
      avatar_url: updateData.avatar_url,
    });
  }

  if (updateData.username && updateData.username.trim()) {
    user.username = updateData.username.trim();
  }
  if (updateData.display_name !== undefined) {
    user.display_name = updateData.display_name;
    user.displayName = updateData.display_name;
  }
  if (updateData.bio !== undefined) {
    user.bio = updateData.bio;
  }
  if (updateData.avatar_url !== undefined) {
    user.avatar_url = updateData.avatar_url;
    user.avatarUrl = updateData.avatar_url;
  }

  return user;
}
