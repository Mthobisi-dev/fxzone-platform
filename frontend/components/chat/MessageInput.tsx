'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send, Image, Smile, Loader2, Mic, MicOff, Radio, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { api } from '@/lib/api';
import { Modal } from '../ui/Modal';

interface MessageInputProps {
  onSendMessage: (text: string) => Promise<void>;
  onTyping?: () => void;
  disabled?: boolean;
}

export function MessageInput({ onSendMessage, onTyping, disabled = false }: MessageInputProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  // Picture sharing states
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice note states
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  // Live session sharing states
  const [sessionShareOpen, setSessionShareOpen] = useState(false);
  const [mySessions, setMySessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending || disabled) return;
    setSending(true);

    try {
      await onSendMessage(text.trim());
      setText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
    if (onTyping) {
      onTyping();
    }
  };

  // Image Upload Handler
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/social/posts/upload', formData);
      if (res?.url) {
        // Send image URL directly in message
        await onSendMessage(res.url);
      }
    } catch (err) {
      console.error('Failed to upload image in chat:', err);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Voice Note Recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([audioBlob], 'voice_note.webm', { type: 'audio/webm' });
        
        setUploadingVoice(true);
        try {
          const formData = new FormData();
          formData.append('file', file);
          const res = await api.post('/api/social/posts/upload', formData);
          if (res?.url) {
            await onSendMessage(`[Voice Note] (url: ${res.url})`);
          }
        } catch (err) {
          console.error('Failed to upload voice note:', err);
        } finally {
          setUploadingVoice(false);
        }
        
        // Stop all audio tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setAudioChunks(chunks);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start audio recording:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);
    }
  };

  // Live Session Sharing
  const openSessionShare = async () => {
    setSessionShareOpen(true);
    setLoadingSessions(true);
    try {
      const res = await api.get('/api/sessions');
      if (Array.isArray(res)) {
        // Filter to live or scheduled sessions
        setMySessions(res);
      }
    } catch (err) {
      console.error('Failed to fetch sessions to share:', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  const shareSession = async (session: any) => {
    try {
      await onSendMessage(`[Live Session] (id: ${session.id}) (title: ${session.title})`);
      setSessionShareOpen(false);
    } catch (err) {
      console.error('Failed to share session:', err);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="p-3 border-t border-zinc-850 bg-zinc-950 flex gap-1.5 items-center select-none">
        {/* Hidden File Input */}
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleImageUpload}
          className="hidden"
        />

        {/* Upload Image Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors shrink-0"
          disabled={disabled || uploadingImage || uploadingVoice}
          title="Share picture"
        >
          {uploadingImage ? <Loader2 size={15} className="animate-spin text-blue-400" /> : <Image size={15} />}
        </button>

        {/* Voice Note Button */}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`p-2 rounded-lg transition-colors shrink-0 ${
            isRecording
              ? 'text-red-500 bg-red-500/10 hover:bg-red-500/20'
              : 'text-zinc-500 hover:text-white hover:bg-zinc-900'
          }`}
          disabled={disabled || uploadingImage || uploadingVoice}
          title={isRecording ? 'Stop Recording and Send' : 'Record voice note'}
        >
          {uploadingVoice ? (
            <Loader2 size={15} className="animate-spin text-purple-400" />
          ) : isRecording ? (
            <MicOff size={15} className="animate-pulse" />
          ) : (
            <Mic size={15} />
          )}
        </button>

        {/* Share Live Session Button */}
        <button
          type="button"
          onClick={openSessionShare}
          className="p-2 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-900 transition-colors shrink-0"
          disabled={disabled || uploadingImage || uploadingVoice}
          title="Share live session invitation"
        >
          <Radio size={15} />
        </button>

        {/* Main Text Input */}
        <input
          type="text"
          value={isRecording ? 'Recording voice note...' : text}
          onChange={handleChange}
          placeholder={isRecording ? 'Press mic icon to stop and send...' : 'Type a message...'}
          className="flex-1 h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-3 text-xs text-white placeholder-zinc-550 focus:outline-none focus:border-zinc-700"
          disabled={disabled || sending || isRecording || uploadingImage || uploadingVoice}
        />

        <Button
          type="submit"
          size="sm"
          className="h-9 px-4 bg-blue-600 hover:bg-blue-500 shrink-0"
          disabled={!text.trim() || sending || disabled || isRecording}
        >
          {sending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
        </Button>
      </form>

      {/* Share Session Modal */}
      {sessionShareOpen && (
        <Modal
          isOpen={sessionShareOpen}
          onClose={() => setSessionShareOpen(false)}
          title="Share Live Session"
        >
          <div className="space-y-3">
            <p className="text-[10px] text-zinc-400">
              Select one of your active live or scheduled trading rooms to send an invitation in this chat.
            </p>

            {loadingSessions ? (
              <div className="h-28 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={18} />
              </div>
            ) : mySessions.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-zinc-850 rounded-xl bg-zinc-950/20">
                <p className="text-[10px] text-zinc-500 italic">No active live sessions found.</p>
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {mySessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => shareSession(session)}
                    className="w-full p-2.5 bg-zinc-900 border border-zinc-850 hover:bg-zinc-850/50 rounded-xl text-left transition-all flex items-center justify-between"
                  >
                    <div>
                      <span className="text-[11px] font-bold text-white block leading-tight">{session.title}</span>
                      <span className="text-[8px] text-zinc-500 capitalize mt-0.5 block">{session.status} session</span>
                    </div>
                    <span className="text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                      Share Invite
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" variant="ghost" onClick={() => setSessionShareOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
