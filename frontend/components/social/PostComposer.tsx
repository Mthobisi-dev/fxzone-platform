'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { Image, Tag, Send, X, Paperclip, Film, FileText, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface PostComposerProps {
  onPostCreated?: () => void;
}

interface MediaFile {
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'document';
  uploadedUrl?: string;
  uploading?: boolean;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { user } = useAuth();
  if (user?.email === 'mthobisimzimela031@gmail.com' || user?.username === 'admin' || user?.role === 'admin') {
    return (
      <Card className="p-4 border border-zinc-900 bg-zinc-950/40 text-center">
        <p className="text-xs text-zinc-500 italic">FxZone Admin accounts are restricted from publishing posts to the social feed.</p>
      </Card>
    );
  }
  const [content, setContent] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [assetTags, setAssetTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_TYPES: Record<string, 'image' | 'video' | 'document'> = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'video/mp4': 'video',
    'video/quicktime': 'video',
    'video/webm': 'video',
    'application/pdf': 'document',
  };

  const getFileType = (file: File): 'image' | 'video' | 'document' | null => {
    return ALLOWED_TYPES[file.type] || null;
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const newMedia: MediaFile[] = [];
    Array.from(files).forEach((file) => {
      const type = getFileType(file);
      if (!type) return;
      if (file.size > 50 * 1024 * 1024) return; // 50MB limit

      const previewUrl = type === 'document'
        ? '' // No preview for documents
        : URL.createObjectURL(file);

      newMedia.push({ file, previewUrl, type });
    });
    if (newMedia.length > 0) {
      setMediaFiles((prev) => [...prev, ...newMedia].slice(0, 5)); // Max 5 files
      setIsExpanded(true);
    }
  }, []);

  const removeMedia = (index: number) => {
    setMediaFiles((prev) => {
      const removed = prev[index];
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const uploadFile = async (media: MediaFile): Promise<string | null> => {
    const formData = new FormData();
    formData.append('file', media.file);
    try {
      const res = await api.post('/api/social/posts/upload', formData);
      return res.url;
    } catch (err) {
      console.error('File upload failed:', err);
      return null;
    }
  };

  const handlePost = async () => {
    if ((!content.trim() && mediaFiles.length === 0) || loading) return;
    setLoading(true);

    try {
      // Upload all media files first
      const uploadedUrls: string[] = [];
      for (const media of mediaFiles) {
        const url = await uploadFile(media);
        if (url) uploadedUrls.push(url);
      }

      // Use first image as image_url, include all in content if multiple
      const imageUrl = uploadedUrls.find((u) =>
        /\.(jpg|jpeg|png|gif|webp)$/i.test(u)
      ) || uploadedUrls[0] || null;

      // If there are additional uploaded files, append links to the content
      let finalContent = content.trim();
      const extraUrls = uploadedUrls.filter((u) => u !== imageUrl);
      if (extraUrls.length > 0) {
        finalContent += '\n\n' + extraUrls.map((u) => `📎 ${u}`).join('\n');
      }

      await api.post('/api/social/posts', {
        content: finalContent,
        image_url: imageUrl,
        asset_tags: assetTags,
      });

      // Clear state
      setContent('');
      setAssetTags([]);
      mediaFiles.forEach((m) => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl); });
      setMediaFiles([]);
      setIsExpanded(false);

      onPostCreated?.();
    } catch (err) {
      console.error('Failed to create post:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = tagInput.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (cleanTag && !assetTags.includes(cleanTag)) {
      setAssetTags((prev) => [...prev, cleanTag]);
    }
    setTagInput('');
  };

  const handleRemoveTag = (index: number) => {
    setAssetTags((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <Card
      className={`p-4 border transition-colors ${isDragOver ? 'border-blue-500 bg-blue-950/20' : 'border-zinc-850 bg-zinc-900/10'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex gap-3">
        {/* User avatar */}
        <div className="shrink-0 mt-1">
          <Avatar src={user?.avatar_url} alt={user?.display_name || 'Avatar'} size="sm" />
        </div>

        {/* Input box */}
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="Share chart setups, market analysis, or trading ideas..."
            rows={isExpanded ? 3 : 1}
            className="w-full bg-transparent border-0 text-xs text-white placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none min-h-[30px]"
          />

          {/* Collapsible parts */}
          {isExpanded && (
            <div className="mt-3 space-y-3 pt-3 border-t border-zinc-850/60">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.pdf"
                onChange={handleFileInputChange}
                className="hidden"
              />

              {/* Media previews */}
              {mediaFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mediaFiles.map((media, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950"
                    >
                      {media.type === 'image' && (
                        <img
                          src={media.previewUrl}
                          alt="Preview"
                          className="w-20 h-20 object-cover"
                        />
                      )}
                      {media.type === 'video' && (
                        <div className="w-20 h-20 flex items-center justify-center bg-zinc-900">
                          <Film size={20} className="text-blue-400" />
                          <span className="text-[8px] text-zinc-400 mt-1 absolute bottom-1 left-1 right-1 truncate">
                            {media.file.name}
                          </span>
                        </div>
                      )}
                      {media.type === 'document' && (
                        <div className="w-20 h-20 flex flex-col items-center justify-center bg-zinc-900 p-1">
                          <FileText size={18} className="text-orange-400" />
                          <span className="text-[8px] text-zinc-400 mt-1 text-center truncate w-full">
                            {media.file.name}
                          </span>
                        </div>
                      )}
                      {/* Remove button */}
                      <button
                        onClick={() => removeMedia(idx)}
                        className="absolute top-0.5 right-0.5 p-0.5 bg-black/70 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Tag inputs */}
              <div className="flex flex-wrap items-center gap-1.5">
                {assetTags.map((tag, idx) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-zinc-950 border border-zinc-850 rounded text-[9px] text-purple-400 font-semibold"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="hover:text-rose-400 transition-colors"
                    >
                      <X size={8} />
                    </button>
                  </span>
                ))}

                <form onSubmit={handleAddTag} className="inline-block">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="+ Tag symbol"
                    className="h-6 w-20 bg-transparent border-0 text-[10px] text-zinc-400 placeholder-zinc-650 focus:ring-0 focus:outline-none px-0.5"
                  />
                </form>
              </div>

              {/* Drag hint */}
              {isDragOver && (
                <div className="text-center py-3 border-2 border-dashed border-blue-500/40 rounded-lg">
                  <p className="text-[10px] text-blue-400">Drop files here to attach</p>
                </div>
              )}

              {/* Toolbar Actions */}
              <div className="flex justify-between items-center select-none pt-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleFileSelect}
                    className="p-1.5 rounded hover:bg-zinc-850 transition-colors text-zinc-400 hover:text-white"
                    title="Attach Image"
                  >
                    <Image size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleFileSelect}
                    className="p-1.5 rounded hover:bg-zinc-850 transition-colors text-zinc-400 hover:text-white"
                    title="Attach Video"
                  >
                    <Film size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleFileSelect}
                    className="p-1.5 rounded hover:bg-zinc-850 transition-colors text-zinc-400 hover:text-white"
                    title="Attach File"
                  >
                    <Paperclip size={13} />
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setIsExpanded(false);
                      setContent('');
                      setAssetTags([]);
                      mediaFiles.forEach((m) => { if (m.previewUrl) URL.revokeObjectURL(m.previewUrl); });
                      setMediaFiles([]);
                    }}
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[10px]"
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handlePost}
                    size="sm"
                    className="h-7 px-3 text-[10px] flex items-center gap-1 bg-blue-600 hover:bg-blue-500"
                    disabled={(!content.trim() && mediaFiles.length === 0) || loading}
                  >
                    {loading ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                    <span>{loading ? 'Posting...' : 'Post idea'}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
