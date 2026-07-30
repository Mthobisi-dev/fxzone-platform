import { create } from 'zustand';
import { api } from '@/lib/api';

export interface UserShort {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  role: string;
}

export interface Post {
  id: string;
  user_id: string;
  user: UserShort;
  content: string;
  image_url?: string;
  asset_tags?: string[];
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  is_story: boolean;
  expires_at?: string;
  created_at: string;
  is_liked?: boolean;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  user: UserShort;
  content: string;
  parent_id?: string;
  created_at: string;
}

interface SocialState {
  posts: Post[];
  stories: Post[];
  isLoading: boolean;
  error: string | null;

  fetchFeed: (limit?: number, offset?: number, isAppend?: boolean) => Promise<void>;
  fetchUserPosts: (userId: string, limit?: number, offset?: number) => Promise<Post[]>;
  createPost: (content: string, imageUrl?: string, assetTags?: string[], isStory?: boolean) => Promise<Post>;
  likePost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string, parentId?: string) => Promise<Comment>;
  fetchComments: (postId: string) => Promise<Comment[]>;
  fetchStories: () => Promise<void>;
  followUser: (followingId: string) => Promise<any>;
  fetchProfile: (userId: string) => Promise<any>;
}

export const useSocialStore = create<SocialState>((set, get) => ({
  posts: [],
  stories: [],
  isLoading: false,
  error: null,

  fetchFeed: async (limit = 15, offset = 0, isAppend = false) => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get('/api/social/feed', {
        params: { limit, offset },
      });
      const mapped = Array.isArray(data) ? data.map((p: any) => ({
        id: p.id,
        user_id: p.user_id || p.userId,
        userId: p.user_id || p.userId,
        user: {
          id: p.user?.id || p.user_id || p.userId,
          username: p.user?.username || '',
          display_name: p.user?.display_name || p.user?.displayName || p.user?.username || '',
          avatar_url: p.user?.avatar_url || p.user?.avatarUrl,
          avatarUrl: p.user?.avatar_url || p.user?.avatarUrl,
          role: p.user?.role || 'trader',
        },
        content: p.content,
        image_url: p.image_url || p.imageUrl,
        imageUrl: p.image_url || p.imageUrl,
        asset_tags: p.asset_tags || p.assetTags || [],
        assetTags: p.asset_tags || p.assetTags || [],
        likes_count: p.likes_count ?? p.likesCount ?? 0,
        likesCount: p.likes_count ?? p.likesCount ?? 0,
        comments_count: p.comments_count ?? p.commentsCount ?? 0,
        commentsCount: p.comments_count ?? p.commentsCount ?? 0,
        reposts_count: p.reposts_count ?? p.repostsCount ?? 0,
        repostsCount: p.reposts_count ?? p.repostsCount ?? 0,
        is_story: p.is_story ?? p.isStory ?? false,
        is_liked: p.is_liked_by_user ?? p.isLikedByUser ?? false,
        created_at: p.created_at || p.createdAt || new Date().toISOString(),
        createdAt: p.created_at || p.createdAt || new Date().toISOString(),
      })) : [];
      
      set((state) => ({
        posts: isAppend ? [...state.posts, ...mapped] : mapped,
        isLoading: false,
      }));
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to load social feed.',
        isLoading: false,
      });
    }
  },

  fetchUserPosts: async (userId, limit = 20, offset = 0) => {
    try {
      return await api.get(`/api/social/users/${userId}/posts`, {
        params: { limit, offset },
      });
    } catch (err: any) {
      console.error(`Failed to load posts for user ${userId}:`, err);
      return [];
    }
  },

  createPost: async (content, imageUrl, assetTags = [], isStory = false) => {
    set({ isLoading: true, error: null });
    try {
      const newPost = await api.post('/api/social/posts', {
        content,
        image_url: imageUrl || null,
        asset_tags: assetTags,
        is_story: isStory,
      });

      if (isStory) {
        set((state) => ({
          stories: [newPost, ...state.stories],
          isLoading: false,
        }));
      } else {
        set((state) => ({
          posts: [newPost, ...state.posts],
          isLoading: false,
        }));
      }

      return newPost;
    } catch (err: any) {
      set({
        error: err.detail || 'Failed to publish post.',
        isLoading: false,
      });
      throw err;
    }
  },

  likePost: async (postId) => {
    try {
      const reactionRes = await api.post(`/api/social/posts/${postId}/react`, {
        reaction_type: 'like',
      });

      // Update local state post metrics
      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              likes_count: reactionRes.likes_count,
              is_liked: reactionRes.active,
            };
          }
          return p;
        }),
      }));
    } catch (err: any) {
      console.error('Failed to react to post:', err);
    }
  },

  addComment: async (postId, content, parentId) => {
    try {
      const comment = await api.post(`/api/social/posts/${postId}/comments`, {
        content,
        parent_id: parentId || null,
      });

      // Increment comments count locally
      set((state) => ({
        posts: state.posts.map((p) => {
          if (p.id === postId) {
            return {
              ...p,
              comments_count: p.comments_count + 1,
            };
          }
          return p;
        }),
      }));

      return comment;
    } catch (err: any) {
      console.error('Failed to comment on post:', err);
      throw err;
    }
  },

  fetchComments: async (postId) => {
    try {
      return await api.get(`/api/social/posts/${postId}/comments`);
    } catch (err: any) {
      console.error('Failed to fetch comments:', err);
      return [];
    }
  },

  fetchStories: async () => {
    try {
      const data = await api.get('/api/social/stories');
      set({ stories: data });
    } catch (err: any) {
      console.error('Failed to fetch stories:', err);
    }
  },

  followUser: async (followingId) => {
    try {
      return await api.post(`/api/social/users/${followingId}/follow`);
    } catch (err: any) {
      console.error('Failed to toggle follow status:', err);
      throw err;
    }
  },

  fetchProfile: async (userId) => {
    try {
      return await api.get(`/api/social/users/${userId}`);
    } catch (err: any) {
      console.error(`Failed to fetch profile for user ${userId}:`, err);
      throw err;
    }
  },
}));
