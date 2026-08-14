'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { useAuth } from '@/hooks/useAuth';
import {
  Image,
  Tag,
  Send,
  X,
  Paperclip,
  Film,
  FileText,
  Loader2,
  Mic,
  MicOff,
  Radio,
  Play,
  Pause,
} from 'lucide-react';
import { api } from '@/lib/api';

interface PostComposerProps {
  onPostCreated?: () => void;
}

interface MediaFile {
  file: File;
  previewUrl: string;
  type: 'image' | 'video' | 'audio' | 'document';
  uploadedUrl?: string;
  uploading?: boolean;
}

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { user } = useAuth();
  if (
    user?.email === 'mthobisimzimela031@gmail.com' ||
    user?.username === 'admin' ||
    user?.role === 'admin'
  ) {
    return (
      <Card className="p-4 border border-zinc-900 bg-zinc-950/40 text-center">
        <p className="text-xs text-zinc-500 italic">
          FxZone Admin accounts are restricted from publishing posts to the social feed.
        </p>
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

  // Voice Note Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<any>(null);

  const ALLOWED_TYPES: Record<string, 'image' | 'video' | 'audio' | 'document'> = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'video/mp4': 'video',
    'video/quicktime': 'video',
    'video/webm': 'video',
    'video/x-matroska': 'video',
    'audio/webm': 'audio',
    'audio/mp3': 'audio',
    'audio/mpeg': 'audio',
    'audio/wav': 'audio',
    'audio/ogg': 'audio',
    'application/pdf': 'document',
  };

  const getFileType = (file: File): 'image' | 'video' | 'audio' | 'document' | null => {
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type.startsWith('image/')) return 'image';
    return ALLOWED_TYPES[file.type] || null;
  };

  const addFiles = useCallback((files: FileList | File[]) => {
    const newMedia: MediaFile[] = [];
    Array.from(files).forEach((file) => {
      const type = getFileType(file);
      if (!type) return;
      if (file.size > 50 * 1024 * 1024) return; // 50MB limit

      const previewUrl =
        type === 'document' ? '' : URL.createObjectURL(file);

      newMedia.push({ file, previewUrl, type });
    });
    if (newMedia.length > 0) {
      setMediaFiles((prev) => [...prev, ...newMedia].slice(0, 5));
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

  // Voice recording handlers
  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-memo-${Date.now()}.webm`, {
          type: 'audio/webm',
        });
        const previewUrl = URL.createObjectURL(audioBlob);

        setMediaFiles((prev) => [
          ...prev,
          { file: audioFile, previewUrl, type: 'audio' },
        ]);
        setIsExpanded(true);

        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start voice memo recording:', err);
      alert('Could not access microphone.');
    }
  };

  const stopVoiceRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
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
      // Upload all attached media files
      const uploadedUrls: string[] = [];
      for (const media of mediaFiles) {
        const url = await uploadFile(media);
        if (url) uploadedUrls.push(url);
      }

      // Primary attachment is first uploaded media
      const primaryUrl = uploadedUrls[0] || null;

      let finalContent = content.trim();
      // If extra attachments, append clean links
      if (uploadedUrls.length > 1) {
        const extraUrls = uploadedUrls.slice(1);
        finalContent += '\n\n' + extraUrls.map((u) => `📎 ${u}`).join('\n');
      }

      await api.post('/api/social/posts', {
        content: finalContent,
        image_url: primaryUrl,
        asset_tags: assetTags,
      });

      // Reset state
      setContent('');
      setAssetTags([]);
      mediaFiles.forEach((m) => {
        if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
      });
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

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const rem = (secs % 60).toString().padStart(2, '0');
    return `${mins}:${rem}`;
  };

  return (
    <Card
      className={`p-4 border transition-colors ${
        isDragOver
          ? 'border-blue-500 bg-blue-950/20'
          : 'border-zinc-850 bg-zinc-900/10'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex gap-3">
        {/* User avatar */}
        <div className="shrink-0 mt-1">
          <Avatar
            src={user?.avatar_url}
            alt={user?.display_name || 'Avatar'}
            size="sm"
          />
        </div>

        {/* Input box */}
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onFocus={() => setIsExpanded(true)}
            placeholder="Share technical analysis, charts, video walkthroughs, or voice memos..."
            rows={isExpanded ? 3 : 1}
            className="w-full bg-transparent border-0 text-xs text-white placeholder-zinc-500 focus:ring-0 focus:outline-none resize-none min-h-[30px]"
          />

          {/* Expanded Tools & Previews */}
          {isExpanded && (
            <div className="mt-3 space-y-3 pt-3 border-t border-zinc-850/60">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,audio/*,.pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />

              {/* Media previews */}
              {mediaFiles.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {mediaFiles.map((media, idx) => (
                    <div
                      key={idx}
                      className="relative group rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-md"
                    >
                      {media.type === 'image' && (
                        <img
                          src={media.previewUrl}
                          alt="Preview"
                          className="w-24 h-24 object-cover"
                        />
                      )}
                      {media.type === 'video' && (
                        <div className="w-32 h-24 bg-zinc-900 flex flex-col items-center justify-center relative p-1">
                          <video
                            src={media.previewUrl}
                            className="w-full h-full object-cover rounded-lg"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <Film size={20} className="text-blue-400" />
                          </div>
                        </div>
                      )}
                      {media.type === 'audio' && (
                        <div className="w-36 h-24 bg-zinc-900/90 flex flex-col items-center justify-center p-2 text-center">
                          <Mic size={20} className="text-purple-400 mb-1" />
                          <span className="text-[9px] font-bold text-zinc-300 truncate w-full">
                            Voice Note
                          </span>
                          <audio
                            src={media.previewUrl}
                            controls
                            className="w-full h-6 mt-1 scale-90"
                          />
                        </div>
                      )}
                      {media.type === 'document' && (
                        <div className="w-24 h-24 flex flex-col items-center justify-center bg-zinc-900 p-1">
                          <FileText size={20} className="text-orange-400" />
                          <span className="text-[8px] text-zinc-400 mt-1 text-center truncate w-full">
                            {media.file.name}
                          </span>
                        </div>
                      )}

                      {/* Remove button */}
                      <button
                        onClick={() => removeMedia(idx)}
                        className="absolute top-1 right-1 p-1 bg-black/80 hover:bg-rose-600 rounded-full text-white transition-colors"
                        title="Remove attachment"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Live Voice Memo Recording Bar */}
              {isRecording && (
                <div className="flex items-center justify-between p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl animate-pulse">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
                    <span className="text-xs font-bold text-red-400 font-mono">
                      Recording Voice Memo: {formatTimer(recordingSeconds)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={stopVoiceRecording}
                    className="h-7 text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-3 flex items-center gap-1"
                  >
                    <MicOff size={12} />
                    <span>Done Recording</span>
                  </Button>
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
                    placeholder="+ Tag asset (e.g. BTCUSD)"
                    className="h-6 w-32 bg-transparent border-0 text-[10px] text-zinc-400 placeholder-zinc-650 focus:ring-0 focus:outline-none px-0.5"
                  />
                </form>
              </div>

              {/* Toolbar Actions */}
              <div className="flex justify-between items-center select-none pt-1">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-lg hover:bg-zinc-850 transition-colors text-zinc-400 hover:text-white flex items-center gap-1 text-[10px]"
                    title="Upload Photo / Chart"
                  >
                    <Image size={14} className="text-blue-400" />
                    <span className="hidden sm:inline">Image</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-lg hover:bg-zinc-850 transition-colors text-zinc-400 hover:text-white flex items-center gap-1 text-[10px]"
                    title="Upload Video"
                  >
                    <Film size={14} className="text-emerald-400" />
                    <span className="hidden sm:inline">Video</span>
                  </button>

                  <button
                    type="button"
                    onClick={isRecording ? stopVoiceRecording : startVoiceRecording}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[10px] ${
                      isRecording
                        ? 'bg-red-500/20 text-red-400 font-bold'
                        : 'hover:bg-zinc-850 text-zinc-400 hover:text-white'
                    }`}
                    title={isRecording ? 'Stop Voice Recording' : 'Record Voice Memo'}
                  >
                    {isRecording ? (
                      <MicOff size={14} className="text-red-400" />
                    ) : (
                      <Mic size={14} className="text-purple-400" />
                    )}
                    <span className="hidden sm:inline">
                      {isRecording ? 'Recording...' : 'Voice Memo'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="p-1.5 rounded-lg hover:bg-zinc-850 transition-colors text-zinc-400 hover:text-white flex items-center gap-1 text-[10px]"
                    title="Attach File / Document"
                  >
                    <Paperclip size={14} className="text-orange-400" />
                    <span className="hidden sm:inline">File</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setIsExpanded(false);
                      setContent('');
                      setAssetTags([]);
                      mediaFiles.forEach((m) => {
                        if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
                      });
                      setMediaFiles([]);
                      if (isRecording) stopVoiceRecording();
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
                    className="h-7 px-3 text-[10px] flex items-center gap-1 bg-blue-600 hover:bg-blue-500 font-bold"
                    disabled={
                      (!content.trim() && mediaFiles.length === 0) || loading
                    }
                  >
                    {loading ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Send size={10} />
                    )}
                    <span>{loading ? 'Posting...' : 'Publish Post'}</span>
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
