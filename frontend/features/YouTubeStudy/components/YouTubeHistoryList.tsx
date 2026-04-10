'use client';

import React, { useEffect, useState } from 'react';
import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';

export interface HistoryItem {
    videoId: string;
    title: string;
    timestamp: number;
    lastWatched: number;
}

export default function YouTubeHistoryList({ currentVideoId }: { currentVideoId?: string }) {
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const router = useRouter();

    useEffect(() => {
        const handleStorage = () => {
             const data = localStorage.getItem('eng-study-yt-history');
             if (data) {
                 try {
                     const parsed = JSON.parse(data) as HistoryItem[];
                     // Sort by last watched descending
                     const sorted = parsed.sort((a, b) => b.lastWatched - a.lastWatched);
                     setHistory(sorted);
                 } catch (e) {
                     console.error('Failed to parse history', e);
                 }
             }
        };

        handleStorage();
        // Since we update history from the same window, listen to a custom event
        window.addEventListener('yt-history-updated', handleStorage);
        return () => window.removeEventListener('yt-history-updated', handleStorage);
    }, []);

    const formatTime = (seconds: number): string => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const formatDate = (ms: number): string => {
        const diff = Date.now() - ms;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(ms).toLocaleDateString();
    };

    if (history.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <p className="text-sm font-medium" style={{ color: 'var(--secondary-color)' }}>No history yet.</p>
                <p className="text-xs opacity-70 mt-2" style={{ color: 'var(--secondary-color)' }}>Videos you watch will appear here.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto w-full scrollbar-thin">
            <div className="flex flex-col gap-1 p-2">
                {history.map((item) => {
                    const isCurrent = item.videoId === currentVideoId;
                    return (
                        <div 
                            key={item.videoId}
                            onClick={() => {
                                if (!isCurrent) {
                                    router.push(`/youtube/${item.videoId}`);
                                }
                            }}
                            className={`flex gap-3 p-2 rounded-xl transition-colors cursor-pointer group ${isCurrent ? 'bg-black/5 dark:bg-white/5 opacity-60' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
                            style={{ 
                                background: isCurrent ? 'rgba(var(--main-color-rgb, 0,200,255), 0.08)' : undefined,
                                border: isCurrent ? '1px solid rgba(var(--main-color-rgb, 0,200,255), 0.2)' : '1px solid transparent'
                            }}
                        >
                            <div className="relative w-32 h-20 rounded-lg overflow-hidden shrink-0 bg-black/10">
                                <img 
                                    src={`https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`} 
                                    alt={item.title}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-medium leading-none">
                                    {formatTime(item.timestamp)}
                                </div>
                                {!isCurrent && (
                                     <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                         <Play className="w-6 h-6 text-white drop-shadow-md" fill="currentColor" />
                                     </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                <h4 
                                    className="text-sm font-semibold leading-tight line-clamp-2"
                                    style={{ color: isCurrent ? 'var(--main-color)' : 'var(--text-color)' }}
                                >
                                    {item.title}
                                </h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs" style={{ color: 'var(--secondary-color)' }}>
                                        {formatDate(item.lastWatched)}
                                    </span>
                                    {isCurrent && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm" style={{ background: 'var(--main-color)', color: 'var(--background-color)' }}>
                                            PLAYING
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
