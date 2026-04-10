import { Router } from 'express';
// @ts-ignore
import { YoutubeTranscript } from 'youtube-transcript-plus';
// @ts-ignore
import translate from 'translate-google';

const router = Router();

// GET /youtube/transcript/:videoId
router.get('/transcript/:videoId', async (req, res): Promise<void> => {
    try {
        const { videoId } = req.params;
        if (!videoId || Array.isArray(videoId)) {
            res.status(400).json({ error: 'Video ID is required' });
            return;
        }

        const vid: string = videoId;

        // Try English first, then any available
        let transcript: any[] = [];
        const languageTries = ['en', ''];
        let lastError: any;
        for (const lang of languageTries) {
            try {
                transcript = lang
                    ? await YoutubeTranscript.fetchTranscript(vid, { lang })
                    : await YoutubeTranscript.fetchTranscript(vid);
                break;
            } catch (err) {
                lastError = err;
            }
        }
        if (!transcript.length) {
            throw lastError;
        }
        res.json({ transcript });
    } catch (error: any) {
        console.error('Fetch YouTube transcript error:', error.message || error);
        res.status(404).json({ error: 'Could not fetch transcripts. The video might not have closed captions enabled.' });
    }
});

// POST /youtube/translate
router.post('/translate', async (req, res): Promise<void> => {
    try {
        const { text, targetLang } = req.body;
        if (!text || typeof text !== 'string') {
            res.status(400).json({ error: 'Text to translate is required' });
            return;
        }

        const translation = await translate(text, { to: targetLang || 'vi' });
        res.json({ translation });
    } catch (error: any) {
        console.error('Translation error:', error.message || error);
        res.status(500).json({ error: 'Failed to translate' });
    }
});

// POST /youtube/chat
router.post('/chat', async (req, res): Promise<void> => {
    try {
        const { videoId, timestamp, message, base64Image, conversationHistory, contextText } = req.body;

        if (!message || typeof message !== 'string' || message.trim().length === 0) {
            res.status(400).json({ error: 'Message is required' });
            return;
        }

        const payload = {
            videoId,
            timestamp,
            message: message.trim(),
            context: contextText || '',
            image: base64Image || null,
            conversationHistory: conversationHistory || [],
        };

        const n8nWebhookUrl = process.env.N8N_YOUTUBE_CHAT_WEBHOOK_URL;
        const n8nUser = process.env.N8N_USERNAME;
        const n8nPass = process.env.N8N_PASSWORD;

        if (!n8nWebhookUrl) {
            res.status(503).json({ error: 'Chat service is not configured.' });
            return;
        }

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (n8nUser && n8nPass) {
            headers['Authorization'] = `Basic ${Buffer.from(`${n8nUser}:${n8nPass}`).toString('base64')}`;
        }

        const n8nRes = await fetch(n8nWebhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
        });

        if (!n8nRes.ok) {
            console.warn(`⚠️ n8n chat webhook returned ${n8nRes.status}`);
            res.status(502).json({ error: `Chat service unavailable (HTTP ${n8nRes.status})` });
            return;
        }

        const result = (await n8nRes.json()) as any;
        res.json({
            reply: result.reply || result.message || 'No response from AI',
            references: result.references || [],
        });

    } catch (error) {
        console.error('YouTube chat endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
