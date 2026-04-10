'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { MessageSquare, Languages, Loader2, ChevronDown, Check, Search } from 'lucide-react';
import EnglishWordSpan from './EnglishWordSpan';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRANSLATE_LANGUAGES = [
    { code: 'vi', name: 'Vietnamese' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'ko', name: 'Korean' },
    { code: 'zh-CN', name: 'Chinese (Simplified)' },
    { code: 'zh-TW', name: 'Chinese (Traditional)' },
    { code: 'ru', name: 'Russian' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'id', name: 'Indonesian' },
    { code: 'th', name: 'Thai' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ar', name: 'Arabic' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranscriptLine {
    text: string;
    offset: number; // seconds
    duration: number;
}

interface InteractiveTranscriptProps {
    videoId: string;
    currentTime: number;
    onChatOpen: (line: TranscriptLine) => void;
    onTranscriptLoaded?: (lines: TranscriptLine[]) => void;
    onSeek?: (time: number) => void;
    hideHeader?: boolean;
    token?: string; // unused, kept for interface compat
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// ─── English tokenizer: split into word/non-word spans ───────────────────────
function tokenizeEnglish(text: string): { surface: string; isWord: boolean }[] {
    // Split on word boundaries: keeps words and punctuation/spaces separate
    const parts = text.split(/(\b[a-zA-Z'-]+\b)/);
    return parts.filter(p => p.length > 0).map(p => ({
        surface: p,
        isWord: /^[a-zA-Z'-]+$/.test(p),
    }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InteractiveTranscript({
    videoId,
    currentTime,
    onChatOpen,
    onTranscriptLoaded,
    onSeek,
    hideHeader,
}: InteractiveTranscriptProps) {
    const [lines, setLines] = useState<TranscriptLine[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeIdx, setActiveIdx] = useState<number>(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
    const userScrollingRef = useRef(false);
    const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ─── Dictionary state ────────────────────────────────────────────────────
    const [dictMode, setDictMode] = useState(false);

    // ─── Translation state ───────────────────────────────────────────────────
    const [targetLang, setTargetLang] = useState('vi');
    const [translations, setTranslations] = useState<Record<number, string>>({});
    const [visibleTranslations, setVisibleTranslations] = useState<Set<number>>(new Set());
    const [loadingTranslations, setLoadingTranslations] = useState<Set<number>>(new Set());
    const [isLangPickerOpen, setIsLangPickerOpen] = useState(false);
    const [langSearch, setLangSearch] = useState('');
    const langPickerRef = useRef<HTMLDivElement>(null);

    // ─── Init from localStorage ──────────────────────────────────────────────
    useEffect(() => {
        const savedLang = localStorage.getItem('eng-study-yt-translate-lang');
        if (savedLang) setTargetLang(savedLang);

        const handleClickOutside = (e: MouseEvent) => {
            if (langPickerRef.current && !langPickerRef.current.contains(e.target as Node)) {
                setIsLangPickerOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ─── Fetch transcript ────────────────────────────────────────────────────
    useEffect(() => {
        const fetchTranscript = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch(`${API_URL}/youtube/transcript/${videoId}`);
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to fetch transcript');
                }
                const { transcript } = await res.json();
                const decodeHtml = (html: string) => {
                    const txt = document.createElement('textarea');
                    txt.innerHTML = html;
                    return txt.value;
                };
                const normalised: TranscriptLine[] = transcript.map((t: any) => ({
                    text: typeof t.text === 'string' ? decodeHtml(t.text) : t.text,
                    offset: Number(t.offset) || 0,
                    duration: Number(t.duration) || 0,
                }));
                setLines(normalised);
                onTranscriptLoaded?.(normalised);
            } catch (err: any) {
                setError(err.message || 'Could not load transcript');
            } finally {
                setIsLoading(false);
            }
        };
        fetchTranscript();
    }, [videoId]);

    // ─── Active line tracking ────────────────────────────────────────────────
    useEffect(() => {
        if (!lines.length) return;
        let idx = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (currentTime >= lines[i].offset) { idx = i; break; }
        }
        setActiveIdx(idx);
    }, [currentTime, lines]);

    // ─── Auto-scroll ─────────────────────────────────────────────────────────
    useEffect(() => {
        if (activeIdx < 0 || userScrollingRef.current) return;
        lineRefs.current[activeIdx]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [activeIdx]);

    // ─── Scroll detection ─────────────────────────────────────────────────────
    const handleScroll = useCallback(() => {
        userScrollingRef.current = true;
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
            userScrollingRef.current = false;
        }, 3000);
    }, []);

    // ─── Translation handlers ─────────────────────────────────────────────────
    const handleTranslate = async (idx: number, text: string) => {
        if (visibleTranslations.has(idx)) {
            setVisibleTranslations(prev => { const n = new Set(prev); n.delete(idx); return n; });
            return;
        }
        if (translations[idx]) {
            setVisibleTranslations(prev => { const n = new Set(prev); n.add(idx); return n; });
            return;
        }
        setLoadingTranslations(prev => { const n = new Set(prev); n.add(idx); return n; });
        try {
            const res = await fetch(`${API_URL}/youtube/translate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, targetLang }),
            });
            if (!res.ok) throw new Error();
            const data = await res.json();
            setTranslations(prev => ({ ...prev, [idx]: data.translation }));
            setVisibleTranslations(prev => { const n = new Set(prev); n.add(idx); return n; });
        } catch {
            console.error('Failed to translate');
        } finally {
            setLoadingTranslations(prev => { const n = new Set(prev); n.delete(idx); return n; });
        }
    };

    const handleLangChange = (code: string) => {
        setTargetLang(code);
        localStorage.setItem('eng-study-yt-translate-lang', code);
        setIsLangPickerOpen(false);
        setTranslations({});
        setVisibleTranslations(new Set());
    };

    // ─── Render a line's text (plain or dict mode) ────────────────────────────
    const renderLineText = useCallback((text: string, lineIdx: number) => {
        if (!dictMode) return text;

        const tokens = tokenizeEnglish(text);
        return (
            <>
                {tokens.map((tok, i) =>
                    tok.isWord ? (
                        <EnglishWordSpan
                            key={i}
                            word={tok.surface}
                            sourceSentence={text}
                            sourceTranslation={translations[lineIdx]}
                        />
                    ) : (
                        <span key={i}>{tok.surface}</span>
                    )
                )}
            </>
        );
    }, [dictMode, translations]);

    // ─── Render ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="flex-1 flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--main-color)' }} />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex-1 flex items-center justify-center h-full px-6 text-center">
                <p className="text-sm" style={{ color: 'rgb(239,68,68)' }}>{error}</p>
            </div>
        );
    }

    const filteredLangs = TRANSLATE_LANGUAGES.filter(l =>
        l.name.toLowerCase().includes(langSearch.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            {!hideHeader && (
                <div
                    className="shrink-0 px-4 py-3 text-sm font-semibold tracking-tight"
                    style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--main-color)' }}
                >
                    Transcript
                </div>
            )}

            {/* Toolbar: Language picker + Dict mode toggle */}
            <div
                className="shrink-0 px-3 py-1.5 flex items-center justify-between gap-2 border-b"
                style={{ borderColor: 'var(--border-color)' }}
            >
                {/* Left: Dict Mode toggle */}
                <button
                    onClick={() => setDictMode(d => !d)}
                    title={dictMode ? 'Dictionary mode: ON' : 'Dictionary mode: OFF'}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold transition-colors"
                    style={{
                        color: dictMode ? 'var(--main-color)' : 'var(--secondary-color)',
                        background: dictMode ? 'rgba(var(--main-color-rgb, 0,200,255), 0.1)' : 'transparent',
                        border: dictMode ? '1px solid rgba(var(--main-color-rgb, 0,200,255), 0.25)' : '1px solid transparent',
                    }}
                >
                    <span style={{ fontSize: '13px' }}>📖</span>
                    <span>Dict</span>
                </button>

                {/* Right: Language picker */}
                <div className="relative" ref={langPickerRef}>
                    <button
                        onClick={() => setIsLangPickerOpen(!isLangPickerOpen)}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold transition-colors"
                        style={{
                            color: 'var(--secondary-color)',
                            background: isLangPickerOpen ? 'var(--card-color)' : 'transparent',
                        }}
                    >
                        <Languages className="w-3.5 h-3.5" />
                        {TRANSLATE_LANGUAGES.find(l => l.code === targetLang)?.name || 'Vietnamese'}
                        <ChevronDown className="w-3 h-3 opacity-60" />
                    </button>

                    {isLangPickerOpen && (
                        <div
                            className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-xl overflow-hidden border z-50 flex flex-col"
                            style={{ background: 'var(--card-color)', borderColor: 'var(--border-color)' }}
                        >
                            {/* Search */}
                            <div className="p-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
                                <div
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
                                    style={{ background: 'var(--background-color)', border: '1px solid var(--border-color)' }}
                                >
                                    <Search className="w-3.5 h-3.5 opacity-50" style={{ color: 'var(--secondary-color)' }} />
                                    <input
                                        type="text"
                                        placeholder="Search language..."
                                        value={langSearch}
                                        onChange={e => setLangSearch(e.target.value)}
                                        className="bg-transparent border-none text-xs w-full outline-none"
                                        style={{ color: 'var(--text-color)' }}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Language list */}
                            <div className="max-h-48 overflow-y-auto scrollbar-thin py-1">
                                {filteredLangs.map(lang => (
                                    <button
                                        key={lang.code}
                                        onClick={() => handleLangChange(lang.code)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-xs transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                                        style={{
                                            color: targetLang === lang.code ? 'var(--main-color)' : 'var(--text-color)',
                                            fontWeight: targetLang === lang.code ? 600 : 400,
                                        }}
                                    >
                                        {lang.name}
                                        {targetLang === lang.code && <Check className="w-3 h-3" />}
                                    </button>
                                ))}
                                {filteredLangs.length === 0 && (
                                    <div className="px-3 py-4 text-xs text-center opacity-50" style={{ color: 'var(--secondary-color)' }}>
                                        No results
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Lines */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto py-2 scrollbar-thin"
            >
                {lines.map((line, idx) => {
                    const isActive = idx === activeIdx;
                    return (
                        <div
                            key={idx}
                            ref={el => { lineRefs.current[idx] = el; }}
                            className="group relative px-4 pr-16 py-2 transition-colors duration-150 cursor-pointer"
                            onClick={() => onSeek?.(line.offset)}
                            style={{
                                background: isActive ? 'rgba(var(--main-color-rgb, 0,200,255), 0.08)' : 'transparent',
                                borderLeft: isActive ? '3px solid var(--main-color)' : '3px solid transparent',
                            }}
                        >
                            {/* Timestamp */}
                            <span
                                className="absolute left-4 top-0 text-[10px] opacity-40 font-mono"
                                style={{ color: 'var(--secondary-color)', marginTop: '2px' }}
                            >
                                {formatTime(line.offset)}
                            </span>

                            {/* Main text */}
                            <div
                                className="text-sm leading-relaxed break-words"
                                onClick={e => { if (window.getSelection()?.toString()) e.stopPropagation(); }}
                                style={{
                                    color: isActive ? 'var(--main-color)' : 'var(--secondary-color)',
                                    fontWeight: isActive ? 600 : 400,
                                    transition: 'color 0.2s, font-weight 0.2s',
                                }}
                            >
                                {renderLineText(line.text, idx)}
                            </div>

                            {/* Translation */}
                            {visibleTranslations.has(idx) && translations[idx] && (
                                <p
                                    className="text-xs mt-1 leading-relaxed opacity-80"
                                    style={{
                                        color: 'var(--secondary-color)',
                                        borderLeft: '2px solid rgba(var(--main-color-rgb, 0,200,255), 0.3)',
                                        paddingLeft: '6px',
                                    }}
                                >
                                    {translations[idx]}
                                </p>
                            )}

                            {/* Action buttons */}
                            <div className={`absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 ${isActive ? 'flex' : 'hidden group-hover:flex'}`}>
                                {/* Translate */}
                                <button
                                    onClick={e => { e.stopPropagation(); handleTranslate(idx, line.text); }}
                                    title="Translate"
                                    disabled={loadingTranslations.has(idx)}
                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
                                    style={{
                                        color: visibleTranslations.has(idx) ? 'var(--main-color)' : 'var(--secondary-color)',
                                        background: visibleTranslations.has(idx) ? 'var(--card-color)' : 'transparent',
                                    }}
                                    onMouseEnter={e => !visibleTranslations.has(idx) && (e.currentTarget.style.background = 'var(--card-color)')}
                                    onMouseLeave={e => !visibleTranslations.has(idx) && (e.currentTarget.style.background = 'transparent')}
                                >
                                    {loadingTranslations.has(idx) ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Languages className="w-3.5 h-3.5" />
                                    )}
                                </button>

                                {/* Ask AI */}
                                <button
                                    onClick={e => { e.stopPropagation(); onChatOpen(line); }}
                                    title="Ask AI about this"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-150"
                                    style={{ color: 'var(--secondary-color)', background: 'transparent' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-color)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}
