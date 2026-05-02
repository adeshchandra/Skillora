import React, { createContext, useContext, useState, ReactNode } from 'react';

interface VideoPlayerContextType {
  activeVideoId: string | null;
  setActiveVideoId: (id: string | null) => void;
  toggleVideo: (id: string) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextType | undefined>(undefined);

export function VideoPlayerProvider({ children }: { children: ReactNode }) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const toggleVideo = (id: string) => {
    setActiveVideoId(prev => prev === id ? null : id);
  };

  return (
    <VideoPlayerContext.Provider value={{ activeVideoId, setActiveVideoId, toggleVideo }}>
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
