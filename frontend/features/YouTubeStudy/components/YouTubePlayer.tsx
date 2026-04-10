'use client';

import React, { useEffect, useRef } from 'react';

declare global {
    interface Window {
        YT: any;
        onYouTubeIframeAPIReady: (() => void) | undefined;
    }
}

interface YouTubePlayerProps {
    videoId: string;
    onProgress?: (currentTime: number) => void;
    onTitle?: (title: string) => void;
    innerRef?: React.MutableRefObject<any>;
    initialTime?: number;
}

export default function YouTubePlayer({ videoId, onProgress, onTitle, innerRef, initialTime }: YouTubePlayerProps) {
    const wrapperRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<any>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        const cleanup = () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            try { playerRef.current?.destroy(); } catch {}
            playerRef.current = null;
        };

        const initPlayer = () => {
            if (!wrapperRef.current) return;
            wrapperRef.current.innerHTML = '';

            // The YT API mounts an <iframe> into this div
            const mountPoint = document.createElement('div');
            wrapperRef.current.appendChild(mountPoint);

            playerRef.current = new window.YT.Player(mountPoint, {
                videoId,
                width: '100%',
                height: '100%',
                playerVars: { 
                    rel: 0, 
                    modestbranding: 1, 
                    iv_load_policy: 3,
                    start: initialTime ? Math.floor(initialTime) : undefined
                },
                events: {
                    onReady: (event: any) => {
                        if (innerRef) innerRef.current = event.target;
                        const iframe = wrapperRef.current?.querySelector('iframe');
                        if (iframe) {
                            iframe.style.width = '100%';
                            iframe.removeAttribute('title');
                            iframe.style.position = 'absolute';
                            // Crop the top ~60px to hide YouTube's title overlay
                            iframe.style.top = '-60px';
                            iframe.style.left = '0';
                            iframe.style.height = 'calc(100% + 60px)';
                        }
                        const data = event.target.getVideoData?.();
                        if (data?.title && onTitle) onTitle(data.title);
                    },
                },
            });
        };

        if (window.YT?.Player) {
            initPlayer();
        } else {
            const prevReady = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                prevReady?.();
                initPlayer();
            };
            if (!document.getElementById('yt-iframe-api')) {
                const script = document.createElement('script');
                script.id = 'yt-iframe-api';
                script.src = 'https://www.youtube.com/iframe_api';
                document.head.appendChild(script);
            }
        }

        return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [videoId]);

    // Poll for progress independently so we don't rely on the onReady closure
    useEffect(() => {
        const timer = setInterval(() => {
            if (playerRef.current && typeof playerRef.current.getCurrentTime === 'function') {
                const t = playerRef.current.getCurrentTime();
                if (typeof t === 'number') {
                    onProgress?.(t);
                }
            }
        }, 500);
        return () => clearInterval(timer);
    }, [onProgress]);

    // The overflow:hidden on wrapperRef crops the top 60px (YouTube title bar)
    // because the iframe has top:-60px, which extends above wrapperRef's top edge.
    // overflow:hidden clips anything outside the element's bounds, including above.
    return (
        <div className="w-full px-0" style={{ maxHeight: '100%' }}>
            <div ref={wrapperRef} style={{ position: 'relative', paddingBottom: '56.25%', width: '100%', background: '#000', overflow: 'hidden' }} />
        </div>
    );
}
