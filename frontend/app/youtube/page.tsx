'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Youtube } from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function YouTubeLandingPage() {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const extractVideoId = (link: string) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
        const match = link.match(regex);
        return match ? match[1] : null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const videoId = extractVideoId(url);
        if (!videoId) {
            setError('Please enter a valid YouTube URL');
            return;
        }

        setIsLoading(true);
        try {
            const res = await fetch(`${API_URL}/youtube/transcript/${videoId}`);
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Failed to fetch video');
            }
            router.push(`/youtube/${videoId}`);
        } catch (err: any) {
            setError(err.message || 'Could not load video transcripts. Closed captions might be disabled.');
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="w-full max-w-md space-y-6">
                <div className="text-center space-y-2">
                    <Youtube className="w-16 h-16 mx-auto text-red-500" />
                    <h1 className="text-3xl font-bold tracking-tight">Language Lab</h1>
                    <p className="text-muted-foreground">
                        Paste a YouTube link to study with interactive transcripts and AI assistant.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            type="url"
                            placeholder="https://www.youtube.com/watch?v=..."
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            disabled={isLoading}
                            required
                            className="w-full"
                        />
                        {error && <p className="text-sm text-destructive">{error}</p>}
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                        {isLoading ? 'Loading...' : 'Start Studying'}
                    </Button>
                </form>
            </div>
        </div>
    );
}
