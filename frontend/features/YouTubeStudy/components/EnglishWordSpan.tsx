'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Volume2, Loader2 } from 'lucide-react';

// ─── Free Dictionary API types ────────────────────────────────────────────────

interface DictPhonetic {
    text?: string;
    audio?: string;
}

interface DictDefinition {
    definition: string;
    example?: string;
}

interface DictMeaning {
    partOfSpeech: string;
    definitions: DictDefinition[];
}

interface DictEntry {
    word: string;
    phonetics: DictPhonetic[];
    meanings: DictMeaning[];
}

// ─── Component ────────────────────────────────────────────────────────────────

interface EnglishWordSpanProps {
    word: string;
    sourceSentence?: string;
    sourceTranslation?: string;
}

export default function EnglishWordSpan({ word, sourceSentence }: EnglishWordSpanProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [entry, setEntry] = useState<DictEntry | null>(null);
    const [error, setError] = useState<string | null>(null);
    const spanRef = useRef<HTMLSpanElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Strip trailing punctuation for lookup
    const cleanWord = word.replace(/[^a-zA-Z'-]/g, '').toLowerCase();

    const fetchDefinition = useCallback(async () => {
        if (!cleanWord) return;
        if (entry || error) { setIsOpen(true); return; }

        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord)}`);
            if (!res.ok) throw new Error('No definition found');
            const data: DictEntry[] = await res.json();
            setEntry(data[0] || null);
            setIsOpen(true);
        } catch {
            setError('No definition found');
            setIsOpen(true);
        } finally {
            setIsLoading(false);
        }
    }, [cleanWord, entry, error]);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isOpen) { setIsOpen(false); return; }
        fetchDefinition();
    };

    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => setIsOpen(false), 400);
    };

    const handleMouseEnter = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    // Best phonetic: prefer one with audio, else first with text
    const phonetic = entry?.phonetics.find(p => p.audio && p.text)
        ?? entry?.phonetics.find(p => p.text)
        ?? entry?.phonetics[0];
    const audioUrl = entry?.phonetics.find(p => p.audio)?.audio;

    const playAudio = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (audioUrl) new Audio(audioUrl).play().catch(() => {});
    };

    // First meaning only for compact display
    const firstMeaning = entry?.meanings[0];
    const firstDef = firstMeaning?.definitions[0];

    return (
        <span
            ref={spanRef}
            className="relative inline-block"
            onMouseLeave={handleMouseLeave}
            onMouseEnter={handleMouseEnter}
        >
            {/* Word itself */}
            <span
                onClick={handleClick}
                className="cursor-pointer rounded-sm transition-colors duration-100"
                style={{
                    borderBottom: isOpen ? '1.5px solid var(--main-color)' : '1.5px dotted rgba(var(--main-color-rgb, 0,200,255), 0.4)',
                    color: isOpen ? 'var(--main-color)' : 'inherit',
                    paddingBottom: '1px',
                }}
            >
                {isLoading ? (
                    <>
                        {word}
                        <Loader2 className="inline w-2.5 h-2.5 ml-0.5 animate-spin" style={{ color: 'var(--main-color)' }} />
                    </>
                ) : word}
            </span>

            {/* Popover */}
            {isOpen && (
                <span
                    className="absolute bottom-full left-0 mb-2 z-[200] block"
                    style={{ minWidth: '220px', maxWidth: '300px' }}
                    onClick={e => e.stopPropagation()}
                >
                    <span
                        className="block rounded-xl shadow-2xl border text-left overflow-hidden"
                        style={{
                            background: 'var(--card-color)',
                            borderColor: 'var(--border-color)',
                            fontSize: '12px',
                            color: 'var(--text-color)',
                        }}
                    >
                        {error ? (
                            <span className="block px-3 py-2.5 opacity-60" style={{ color: 'var(--secondary-color)' }}>
                                No definition found for &ldquo;{cleanWord}&rdquo;
                            </span>
                        ) : entry ? (
                            <>
                                {/* Word + phonetic + audio */}
                                <span
                                    className="flex items-center gap-2 px-3 pt-2.5 pb-1.5"
                                    style={{ borderBottom: '1px solid var(--border-color)' }}
                                >
                                    <span className="font-bold text-[14px]" style={{ color: 'var(--main-color)' }}>
                                        {entry.word}
                                    </span>
                                    {phonetic?.text && (
                                        <span className="opacity-60 text-[11px] font-mono" style={{ color: 'var(--secondary-color)' }}>
                                            {phonetic.text}
                                        </span>
                                    )}
                                    {audioUrl && (
                                        <button
                                            onClick={playAudio}
                                            className="ml-auto w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                                            style={{ color: 'var(--main-color)', background: 'transparent' }}
                                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(var(--main-color-rgb, 0,200,255), 0.1)')}
                                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                            title="Play pronunciation"
                                        >
                                            <Volume2 className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </span>

                                {/* Part of speech + definition */}
                                {firstMeaning && (
                                    <span className="block px-3 py-2">
                                        <span
                                            className="inline-block text-[10px] font-semibold uppercase tracking-wider mb-1.5 px-1.5 py-0.5 rounded"
                                            style={{
                                                color: 'var(--main-color)',
                                                background: 'rgba(var(--main-color-rgb, 0,200,255), 0.1)',
                                            }}
                                        >
                                            {firstMeaning.partOfSpeech}
                                        </span>
                                        <span className="block leading-relaxed" style={{ color: 'var(--secondary-color)' }}>
                                            {firstDef?.definition}
                                        </span>
                                        {firstDef?.example && (
                                            <span
                                                className="block mt-1.5 text-[11px] italic opacity-70 leading-relaxed"
                                                style={{ color: 'var(--secondary-color)', borderLeft: '2px solid var(--border-color)', paddingLeft: '6px' }}
                                            >
                                                &ldquo;{firstDef.example}&rdquo;
                                            </span>
                                        )}
                                    </span>
                                )}

                                {/* More meanings count */}
                                {entry.meanings.length > 1 && (
                                    <span
                                        className="block px-3 pb-2 text-[10px] opacity-50"
                                        style={{ color: 'var(--secondary-color)' }}
                                    >
                                        +{entry.meanings.length - 1} more meaning{entry.meanings.length > 2 ? 's' : ''}
                                    </span>
                                )}
                            </>
                        ) : null}
                    </span>
                    {/* Arrow */}
                    <span
                        className="block absolute -bottom-1 left-4 w-2 h-2 rotate-45"
                        style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderTop: 'none', borderLeft: 'none' }}
                    />
                </span>
            )}
        </span>
    );
}
