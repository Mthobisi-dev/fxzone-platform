import os

BASE_DIR = r"C:\Users\mthob\.gemini\antigravity\scratch\fxzone-platform"

def replace(filepath, old, new):
    path = os.path.join(BASE_DIR, filepath)
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    if old not in content:
        print(f"FAILED: {filepath} - old content not found")
        print("Expected:", repr(old[:50]))
    else:
        content = content.replace(old, new, 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"SUCCESS: {filepath}")

# 1 models.py
replace("backend/shared/models.py",
"""    content = Column(Text, nullable=False)
    image_url = Column(Text)
    likes_count = Column(Integer, default=0)""",
"""    content = Column(Text, nullable=False)
    image_url = Column(Text)
    caption = Column(String(200), nullable=True)
    likes_count = Column(Integer, default=0)""")

# 2 database.py
replace("backend/shared/database.py",
"""                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_comments_count BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_likes_count BOOLEAN DEFAULT TRUE;",""",
"""                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS caption VARCHAR(200);",
                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_comments_count BOOLEAN DEFAULT TRUE;",
                    "ALTER TABLE posts ADD COLUMN IF NOT EXISTS show_likes_count BOOLEAN DEFAULT TRUE;",""")

replace("backend/shared/database.py",
"""                "ALTER TABLE posts ADD COLUMN reposts_count INTEGER DEFAULT 0",
                "ALTER TABLE posts ADD COLUMN show_comments_count BOOLEAN DEFAULT 1",
                "ALTER TABLE posts ADD COLUMN show_likes_count BOOLEAN DEFAULT 1",""",
"""                "ALTER TABLE posts ADD COLUMN caption TEXT",
                "ALTER TABLE posts ADD COLUMN reposts_count INTEGER DEFAULT 0",
                "ALTER TABLE posts ADD COLUMN show_comments_count BOOLEAN DEFAULT 1",
                "ALTER TABLE posts ADD COLUMN show_likes_count BOOLEAN DEFAULT 1",""")

# 3 schemas.py
replace("backend/services/social/schemas.py",
"""    content: str = Field(..., max_length=1000, description="The textual content of the post.")
    image_url: Optional[str] = Field(None, description="Optional image/chart URL attached to the post.")
    asset_tags: List[str] = Field(default_factory=list, description="Assets tagged in this post, e.g. ['BTCUSD'].")""",
"""    content: str = Field(..., max_length=1000, description="The textual content of the post.")
    image_url: Optional[str] = Field(None, description="Optional image/chart URL attached to the post.")
    caption: Optional[str] = Field(None, max_length=200, description="Short caption displayed below image.")
    asset_tags: List[str] = Field(default_factory=list, description="Assets tagged in this post, e.g. ['BTCUSD'].")""")

replace("backend/services/social/schemas.py",
"""    content: str
    image_url: Optional[str] = None
    asset_tags: Optional[List[str]] = []""",
"""    content: str
    image_url: Optional[str] = None
    caption: Optional[str] = None
    asset_tags: Optional[List[str]] = []""")

# 4 service.py
replace("backend/services/social/service.py",
"""        post = Post(
            user_id=u_uuid,
            content=data.content,
            image_url=data.image_url,
            tagged_assets=tagged_assets,""",
"""        post = Post(
            user_id=u_uuid,
            content=data.content,
            image_url=data.image_url,
            caption=getattr(data, 'caption', None),
            tagged_assets=tagged_assets,""")

replace("backend/services/social/service.py",
"""            "content": p.content,
            "image_url": p.image_url,
            "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],""",
"""            "content": p.content,
            "image_url": p.image_url,
            "caption": getattr(p, "caption", None),
            "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],""")

replace("backend/services/social/service.py",
"""                "content": p.content,
                "image_url": p.image_url,
                "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],""",
"""                "content": p.content,
                "image_url": p.image_url,
                "caption": getattr(p, "caption", None),
                "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],""")

replace("backend/services/social/service.py",
"""                "content": p.content,
                "image_url": p.image_url,
                "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],""",
"""                "content": p.content,
                "image_url": p.image_url,
                "caption": getattr(p, "caption", None),
                "asset_tags": [a.symbol for a in p.tagged_assets] if p.tagged_assets else [],""")

# 5 config.py
replace("backend/config.py",
"""    ALPHA_VANTAGE_KEY: Optional[str] = None
    FINNHUB_KEY: Optional[str] = None

    # App""",
"""    ALPHA_VANTAGE_KEY: Optional[str] = None
    FINNHUB_KEY: Optional[str] = None
    FRED_API_KEY: Optional[str] = None
    FMP_API_KEY: Optional[str] = None

    # App""")

# 6 render.yaml
replace("render.yaml",
"""      - key: REFRESH_TOKEN_EXPIRE_DAYS
        value: "30"
      - key: CORS_ORIGINS
        value: '["http://localhost:3000","https://fxzone-platform-4dqe.vercel.app","https://fxzone-platform.vercel.app"]'

databases:""",
"""      - key: REFRESH_TOKEN_EXPIRE_DAYS
        value: "30"
      - key: CORS_ORIGINS
        value: '["http://localhost:3000","https://fxzone-platform-4dqe.vercel.app","https://fxzone-platform.vercel.app"]'
      - key: ALPHA_VANTAGE_KEY
        value: QH4RURKPH3A8S2MX
      - key: FRED_API_KEY
        value: b6fb9b5c82d9ab687d281dcad40e377c
      - key: FMP_API_KEY
        value: pOXbkN6XSF1MeruhUROz3pZIxWwOLpWk

databases:""")

# 7 main.py
replace("backend/main.py",
"""# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    \"\"\"Simple check to verify API service health.\"\"\"
    return {
        "status": "healthy",
        "app": "FxZone",
        "version": "1.0.0"
    }""",
"""# Health check endpoint
@app.get("/health", tags=["System"])
async def health_check():
    \"\"\"Detailed health check reporting database engine type and service status.\"\"\"
    from shared import database as _db
    from config import settings
    redis_cls = type(_db._redis_client).__name__ if _db._redis_client else "none"
    mongo_cls = type(_db._mongo_db).__name__ if _db._mongo_db else "none"
    db_engine = "sqlite" if _db._use_sqlite else "postgresql"
    return {
        "status": "healthy",
        "app": "FxZone",
        "version": "1.0.0",
        "database": db_engine,
        "redis": redis_cls,
        "mongodb": mongo_cls,
        "app_env": settings.APP_ENV,
    }""")

# 9 PostComposer.tsx
replace("frontend/components/social/PostComposer.tsx",
"""  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [assetTags, setAssetTags] = useState<string[]>([]);""",
"""  const [content, setContent] = useState('');
  const [caption, setCaption] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [assetTags, setAssetTags] = useState<string[]>([]);""")

replace("frontend/components/social/PostComposer.tsx",
"""      await api.post('/api/social/posts', {
        content: finalContent,
        image_url: primaryUrl,
        asset_tags: assetTags,
        show_comments_count: showCommentsCount,""",
"""      await api.post('/api/social/posts', {
        content: finalContent,
        image_url: primaryUrl,
        caption: caption || undefined,
        asset_tags: assetTags,
        show_comments_count: showCommentsCount,""")

replace("frontend/components/social/PostComposer.tsx",
"""      // Reset state
      setContent('');
      setAssetTags([]);""",
"""      // Reset state
      setContent('');
      setCaption('');
      setAssetTags([]);""")

replace("frontend/components/social/PostComposer.tsx",
"""            className="w-full bg-transparent border-0 text-xs text-white placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none min-h-[36px] leading-relaxed"
          />

          {/* Dedicated Media Caption Indicator if files attached */}""",
"""            className="w-full bg-transparent border-0 text-xs text-white placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none min-h-[36px] leading-relaxed"
          />

          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="Add a caption... (optional)"
            className="w-full px-3 py-2 text-sm bg-gray-800/50 border border-gray-700/50 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors mt-2"
          />

          {/* Dedicated Media Caption Indicator if files attached */}""")

replace("frontend/components/social/PostComposer.tsx",
"""                      setIsExpanded(false);
                      setContent('');
                      setAssetTags([]);""",
"""                      setIsExpanded(false);
                      setContent('');
                      setCaption('');
                      setAssetTags([]);""")


# 10 PostCard.tsx
replace("frontend/components/social/PostCard.tsx",
"""  content: string;
  imageUrl?: string;
  assetTags: string[];""",
"""  content: string;
  imageUrl?: string;
  caption?: string | null;
  assetTags: string[];""")

replace("frontend/components/social/PostCard.tsx",
"""                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </div>
          )}

          {/* Asset Tags */}""",
"""                onError={(e) => {
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
            </div>
          )}

          {post.caption && (
            <p className="text-xs text-gray-400 italic mt-1 px-1 mb-3">{post.caption}</p>
          )}

          {/* Asset Tags */}""")

replace("frontend/components/social/PostCard.tsx",
"""  // Repost / Reshare Post
  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (repostLoading) return;
    setRepostLoading(true);

    const nextReposted = !isReposted;
    setIsReposted(nextReposted);
    setReposts((prev) => (nextReposted ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await api.post(`/api/social/posts/${post.id}/repost`, {});
      if (res && typeof res.reposts_count === 'number') {
        setReposts(res.reposts_count);
        setIsReposted(res.is_reposted ?? nextReposted);
      }
      // Refresh the feed so reshared posts appear immediately
      window.dispatchEvent(new CustomEvent('fxzone_refresh_feed'));
    } catch (err) {
      console.error('Repost error:', err);
      setIsReposted(!nextReposted);
      setReposts((prev) => (!nextReposted ? prev + 1 : Math.max(0, prev - 1)));
    } finally {
      setRepostLoading(false);
    }
  };""",
"""  const [repostModalOpen, setRepostModalOpen] = useState(false);
  const [repostCaption, setRepostCaption] = useState('');

  // Repost / Reshare Post
  const handleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (repostLoading) return;
    setRepostModalOpen(true);
  };

  const submitRepost = async () => {
    setRepostLoading(true);
    try {
      if (repostCaption.trim()) {
        await api.post('/api/social/posts', {
          content: `[Reshared from @${postUser.username}]: ${post.content}`,
          caption: repostCaption,
          image_url: imageUrl,
          asset_tags: assetTags
        });
        setReposts(prev => prev + 1);
        setIsReposted(true);
      } else {
        const nextReposted = !isReposted;
        setIsReposted(nextReposted);
        setReposts((prev) => (nextReposted ? prev + 1 : Math.max(0, prev - 1)));
        const res = await api.post(`/api/social/posts/${post.id}/repost`, {});
        if (res && typeof res.reposts_count === 'number') {
          setReposts(res.reposts_count);
          setIsReposted(res.is_reposted ?? nextReposted);
        }
      }
      window.dispatchEvent(new CustomEvent('fxzone_refresh_feed'));
      setRepostModalOpen(false);
    } catch (err) {
      console.error('Repost error:', err);
    } finally {
      setRepostLoading(false);
    }
  };""")

replace("frontend/components/social/PostCard.tsx",
"""      {/* Share / Reshare Post Modal */}
      {shareModalOpen && (""",
"""      {/* Repost Modal */}
      {repostModalOpen && (
        <Modal
          isOpen={repostModalOpen}
          onClose={() => setRepostModalOpen(false)}
          title="Repost"
        >
          <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-850 text-xs text-zinc-300">
              <span className="text-zinc-500 font-bold block mb-1">@{postUser.username}:</span>
              <p className="line-clamp-3 italic">&quot;{post.content}&quot;</p>
            </div>
            <textarea
              value={repostCaption}
              onChange={(e) => setRepostCaption(e.target.value)}
              placeholder="Add a caption... (optional)"
              className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
            />
            <Button onClick={submitRepost} disabled={repostLoading} className="w-full">
              {repostLoading ? 'Reposting...' : 'Repost'}
            </Button>
          </div>
        </Modal>
      )}

      {/* Share Post Modal */}
      {shareModalOpen && (""")

# 11 feed mapping
replace("frontend/app/(dashboard)/feed/page.tsx",
"""          createdAt: p.created_at || p.createdAt || new Date().toISOString(),
          repostedBy: p.reposted_by || p.repostedBy || null,
        }));""",
"""          createdAt: p.created_at || p.createdAt || new Date().toISOString(),
          repostedBy: p.reposted_by || p.repostedBy || null,
          caption: p.caption || null,
        }));""")

# 12 profile mapping
replace("frontend/app/(dashboard)/profile/[id]/page.tsx",
"""          content: p.content,
          imageUrl: p.image_url || p.imageUrl,
          assetTags: p.asset_tags || p.assetTags || [],""",
"""          content: p.content,
          imageUrl: p.image_url || p.imageUrl,
          caption: p.caption || null,
          assetTags: p.asset_tags || p.assetTags || [],""")

replace("frontend/app/(dashboard)/profile/[id]/page.tsx",
"""          content: p.content,
          imageUrl: p.image_url || p.imageUrl,
          assetTags: p.asset_tags || p.assetTags || [],""",
"""          content: p.content,
          imageUrl: p.image_url || p.imageUrl,
          caption: p.caption || null,
          assetTags: p.asset_tags || p.assetTags || [],""")
