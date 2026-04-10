'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, Send, MessageCircle, Loader2, AlertCircle, CornerDownRight, Trash2 } from 'lucide-react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    quotedText?: string;
}

interface TranscriptLine {
    text: string;
    offset: number;
    duration: number;
}

interface YouTubeChatDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    videoId: string;
    videoTitle: string;
    currentTime: number;
    quotedLine: TranscriptLine | null;
    onQuotedLineUsed: () => void;
    transcript: TranscriptLine[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

const YouTubeChatDrawer = React.memo(function YouTubeChatDrawer({
    isOpen,
    onClose,
    videoId,
    videoTitle,
    currentTime,
    quotedLine,
    onQuotedLineUsed,
    transcript,
}: YouTubeChatDrawerProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [drawerWidth, setDrawerWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load saved width
    useEffect(() => {
        const saved = localStorage.getItem('kana-dojo-yt-chat-width');
        if (saved) setDrawerWidth(Number(saved));
    }, []);

    // Resize drag handler
    useEffect(() => {
        if (!isResizing) return;
        const onMove = (e: MouseEvent) => {
            let w = window.innerWidth - e.clientX;
            w = Math.max(320, Math.min(800, w, window.innerWidth * 0.8));
            setDrawerWidth(w);
        };
        const onUp = () => {
            setIsResizing(false);
            localStorage.setItem('kana-dojo-yt-chat-width', drawerWidth.toString());
        };
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'col-resize';
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [isResizing, drawerWidth]);

    // Scroll on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Focus input on open / quoted
    useEffect(() => {
        if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
    }, [isOpen]);

    useEffect(() => {
        if (quotedLine && isOpen) inputRef.current?.focus();
    }, [quotedLine, isOpen]);

    const buildContext = (quotedOff: number): string => {
        const WINDOW = 5; // lines before/after
        const idx = transcript.findIndex(l => Math.abs(l.offset - quotedOff) < 1);
        const start = Math.max(0, idx - WINDOW);
        const end = Math.min(transcript.length - 1, idx + WINDOW);
        const surrounding = transcript.slice(start, end + 1).map(l => l.text).join(' ');
        return `Video: ${videoTitle}\nTimestamp: ${formatTime(quotedOff)}\n\nSurrounding transcript context:\n${surrounding}`;
    };

    const handleSend = async () => {
        const hasText = input.trim().length > 0;
        const hasQuote = !!quotedLine;
        if ((!hasText && !hasQuote) || isLoading) return;

        const displayContent = hasText ? input.trim() : '';
        const apiMsg = hasQuote
            ? `Quote: 「${quotedLine!.text}」\n\n${hasText ? input.trim() : 'Please explain this sentence.'}`
            : input.trim();

        const userMessage: Message = {
            role: 'user',
            content: displayContent || 'Please explain this sentence.',
            timestamp: Date.now(),
            quotedText: quotedLine?.text,
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setError(null);
        if (quotedLine) onQuotedLineUsed();

        const contextText = quotedLine ? buildContext(quotedLine.offset) : `Video: ${videoTitle}\nTimestamp: ${formatTime(currentTime)}`;

        try {
            const res = await fetch(`${API_URL}/youtube/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoId,
                    timestamp: quotedLine?.offset ?? currentTime,
                    message: apiMsg,
                    contextText,
                    conversationHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Failed to get a response');
            }

            const data = await res.json();
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: data.reply,
                timestamp: Date.now(),
            }]);
        } catch (err: any) {
            setError(err.message || 'Failed to send message');
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const canSend = (input.trim().length > 0 || !!quotedLine) && !isLoading;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[80]"
                        style={{ background: 'rgba(0,0,0,0.45)' }}
                    />

                    {/* Mobile: bottom sheet */}
                    <motion.div
                        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.9 }}
                        className="fixed inset-0 z-[90] flex flex-col md:hidden"
                        style={{ background: 'var(--background-color)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
                    >
                        <DrawerContent 
                            messages={messages}
                            setMessages={setMessages}
                            input={input}
                            setInput={setInput}
                            handleKeyDown={handleKeyDown}
                            handleSend={handleSend}
                            isLoading={isLoading}
                            error={error}
                            quotedLine={quotedLine}
                            onQuotedLineUsed={onQuotedLineUsed}
                            isFocused={isFocused}
                            setIsFocused={setIsFocused}
                            onClose={onClose}
                            inputRef={inputRef}
                            messagesEndRef={messagesEndRef}
                            canSend={canSend}
                        />
                    </motion.div>

                    {/* Desktop: side drawer */}
                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 28, stiffness: 280, mass: 0.8 }}
                        className="fixed right-0 top-0 h-full z-[90] flex-col hidden md:flex"
                        style={{ background: 'var(--background-color)', borderLeft: '1px solid var(--border-color)', width: `${drawerWidth}px` }}
                    >
                        {/* Drag handle */}
                        <div
                            onMouseDown={e => { e.preventDefault(); setIsResizing(true); }}
                            className="absolute left-0 top-0 bottom-0 w-3 cursor-col-resize z-[100]"
                            style={{ transform: 'translateX(-50%)' }}
                        >
                            <div className="w-[3px] h-full mx-auto" style={{ background: 'var(--main-color)', opacity: isResizing ? 0.6 : 0, transition: 'opacity 0.2s' }} />
                        </div>
                        <DrawerContent 
                            messages={messages}
                            setMessages={setMessages}
                            input={input}
                            setInput={setInput}
                            handleKeyDown={handleKeyDown}
                            handleSend={handleSend}
                            isLoading={isLoading}
                            error={error}
                            quotedLine={quotedLine}
                            onQuotedLineUsed={onQuotedLineUsed}
                            isFocused={isFocused}
                            setIsFocused={setIsFocused}
                            onClose={onClose}
                            inputRef={inputRef}
                            messagesEndRef={messagesEndRef}
                            canSend={canSend}
                        />
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
});

// --- Drawer Content Sub-component ---
function DrawerContent({
    messages,
    setMessages,
    input,
    setInput,
    handleKeyDown,
    handleSend,
    isLoading,
    error,
    quotedLine,
    onQuotedLineUsed,
    isFocused,
    setIsFocused,
    onClose,
    inputRef,
    messagesEndRef,
    canSend
}: any) {
    return (
        <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)' }}>
                        <MessageCircle className="w-4 h-4" style={{ color: 'var(--main-color)' }} />
                    </div>
                    <span className="text-base font-semibold tracking-tight" style={{ color: 'var(--main-color)' }}>
                        Video Assistant
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    {messages.length > 0 && (
                        <button onClick={() => setMessages([])} title="Clear chat" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--secondary-color)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-color)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            <Trash2 className="w-4 h-4 opacity-75" />
                        </button>
                    )}
                    <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ color: 'var(--secondary-color)' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--card-color)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5 scrollbar-thin">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 text-center pb-12">
                        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)' }}>
                            <MessageCircle className="w-7 h-7 opacity-60" style={{ color: 'var(--main-color)' }} />
                        </div>
                        <div>
                            <p className="font-semibold mb-1" style={{ color: 'var(--main-color)' }}>Ask about the video</p>
                            <p className="text-sm leading-relaxed max-w-[260px]" style={{ color: 'var(--secondary-color)' }}>
                                Tap the chat icon on any subtitle line, or type your question below.
                            </p>
                        </div>
                    </div>
                )}

                {messages.map((msg: any, idx: number) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'user' ? (
                            <div className="max-w-[82%] flex flex-col items-end gap-1.5">
                                {msg.quotedText && (
                                    <div className="w-full rounded-xl px-3 py-2 text-sm" style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', borderLeft: '3px solid var(--main-color)', color: 'var(--secondary-color)' }}>
                                        <span className="block text-[10px] font-semibold uppercase tracking-widest mb-1 opacity-60" style={{ color: 'var(--main-color)' }}>Quoted</span>
                                        <span className="leading-relaxed">「{msg.quotedText}」</span>
                                    </div>
                                )}
                                {msg.content && (
                                    <div className="rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed" style={{ background: 'var(--main-color)', color: 'var(--background-color)' }}>
                                        {msg.content}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="max-w-[82%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm leading-relaxed break-words" style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', color: 'var(--secondary-color)' }}>
                                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                    p: ({ children }: any) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                                    strong: ({ children }: any) => <strong className="font-bold" style={{ color: 'var(--main-color)' }}>{children}</strong>,
                                    em: ({ children }: any) => <em className="italic opacity-80">{children}</em>,
                                    ul: ({ children }: any) => <ul className="list-disc pl-4 mb-3 last:mb-0 space-y-1">{children}</ul>,
                                    ol: ({ children }: any) => <ol className="list-decimal pl-4 mb-3 last:mb-0 space-y-1">{children}</ol>,
                                    li: ({ children }: any) => <li className="my-0.5">{children}</li>,
                                    code: ({ className, children, ...props }: any) => {
                                        const inline = !className;
                                        return inline
                                            ? <code className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--border-color)' }} {...props}>{children}</code>
                                            : <div className="my-3 rounded-lg overflow-hidden text-[11px] font-mono p-3 overflow-x-auto" style={{ background: 'var(--background-color)', border: '1px solid var(--border-color)' }}><code {...props}>{children}</code></div>;
                                    },
                                }}>
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                ))}

                {isLoading && (
                    <div className="flex justify-start">
                        <div className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2 text-sm" style={{ background: 'var(--card-color)', border: '1px solid var(--border-color)', color: 'var(--secondary-color)' }}>
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--main-color)' }} />
                        </div>
                    </div>
                )}
                {error && (
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: 'rgb(239,68,68)' }}>
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="shrink-0 px-4 py-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                <div
                    className="rounded-2xl overflow-hidden transition-all duration-200"
                    style={{ background: 'var(--card-color)', border: `1px solid ${isFocused ? 'var(--main-color)' : 'var(--border-color)'}` }}
                    onFocusCapture={() => setIsFocused(true)}
                    onBlurCapture={() => setIsFocused(false)}
                >
                    <AnimatePresence>
                        {quotedLine && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.15 }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div className="flex items-start gap-2 px-3 pt-3 pb-1 text-xs" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                    <CornerDownRight className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: 'var(--main-color)' }} />
                                    <span className="flex-1 leading-relaxed line-clamp-2" style={{ color: 'var(--secondary-color)' }}>{quotedLine.text}</span>
                                    <button onClick={onQuotedLineUsed} className="shrink-0 mt-0.5 opacity-40 hover:opacity-100 transition-opacity" style={{ color: 'var(--secondary-color)' }}>
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <div className="flex items-end gap-2 px-3 py-2">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={quotedLine ? 'Ask about this...' : 'Ask anything about the video…'}
                            disabled={isLoading}
                            rows={1}
                            className="flex-1 resize-none bg-transparent text-sm outline-none focus:outline-none focus:ring-0 focus-visible:outline-none"
                            style={{ 
                                color: 'var(--main-color)', 
                                minHeight: '36px', 
                                maxHeight: '120px', 
                                lineHeight: '1.5', 
                                paddingTop: '6px', 
                                paddingBottom: '6px',
                                outline: 'none',
                                boxShadow: 'none'
                            }}
                            onInput={e => {
                                const el = e.currentTarget;
                                el.style.height = 'auto';
                                el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!canSend}
                            className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-150 mb-0.5"
                            style={{ background: canSend ? 'var(--main-color)' : 'var(--border-color)', color: canSend ? 'var(--background-color)' : 'var(--secondary-color)', cursor: canSend ? 'pointer' : 'not-allowed' }}
                        >
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}

export default YouTubeChatDrawer;
