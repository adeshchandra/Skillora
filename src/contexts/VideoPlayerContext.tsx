import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

interface VisibleItem {
  id: string;
  top: number;
}

interface VideoPlayerContextType {
  activeVideoId: string | null;
  autoplayId: string | null;
  setActiveVideoId: (id: string | null) => void;
  toggleVideo: (id: string) => void;
  registerVisible: (id: string, top: number) => void;
  unregisterVisible: (id: string) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | undefined>(undefined);

export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [visibleItems, setVisibleItems] = useState<VisibleItem[]>([]);

  const toggleVideo = useCallback((id: string) => {
    setActiveVideoId(prev => prev === id ? null : id);
  }, []);

  const registerVisible = useCallback((id: string, top: number) => {
    setVisibleItems(prev => {
      const existing = prev.find(item => item.id === id);
      if (existing && Math.abs(existing.top - top) < 1) return prev; // Avoid infinitesimal changes
      const filtered = prev.filter(item => item.id !== id);
      // Sort by top position to ensure the video closest to viewport top is prioritized
      return [...filtered, { id, top }].sort((a, b) => a.top - b.top);
    });
  }, []);

  const unregisterVisible = useCallback((id: string) => {
    setVisibleItems(prev => {
      const exists = prev.some(item => item.id === id);
      if (!exists) return prev;
      return prev.filter(item => item.id !== id);
    });
  }, []);

  const autoplayId = visibleItems.length > 0 ? visibleItems[0].id : null;

  return (
    <VideoPlayerContext.Provider value={{ 
      activeVideoId, 
      setActiveVideoId, 
      toggleVideo,
      autoplayId,
      registerVisible,
      unregisterVisible 
    }}>
      {children}
    </VideoPlayerContext.Provider>
  );
}

export function useVideoPlayer() {
  const context = useContext(VideoPlayerContext);
  if (context === undefined) {
    throw new Error('useVideoPlayer must be used within a VideoPlayerProvider');
  }
  return context;
}
