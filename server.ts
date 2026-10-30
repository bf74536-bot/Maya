import http from 'http';
import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

// Increase JSON limit for audio base64 uploads
app.use(express.json({ limit: '30mb' }));

// Serve static public assets (manifest.json, sw.js, icons)
app.use(express.static(path.join(__dirname, 'public')));

const getApiKey = (req?: express.Request | http.IncomingMessage | any): string => {
  const headerKey = (req?.headers?.['x-gemini-api-key'] || req?.headers?.['x-api-key']) as string;
  const bodyKey = req?.body?.apiKey;
  let queryKey = req?.query?.key as string;
  if (!queryKey && req?.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      queryKey = parsedUrl.searchParams.get('key') || '';
    } catch (e) {
      // ignore
    }
  }
  return (
    headerKey ||
    bodyKey ||
    queryKey ||
    process.env.GEMINI_API_KEY ||
    process.env.VITE_GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    ''
  ).trim();
};

function getAIClient(customKey?: string) {
  const key = (customKey || getApiKey()).trim();
  return new GoogleGenAI({
    apiKey: key,
  });
}

const ai = getAIClient();

function getDynamicSystemInstruction(memories?: any[]) {
  const now = new Date();
  const istTimeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'full',
    timeStyle: 'medium',
  }).format(now);

  let memoryContext = '';
  if (Array.isArray(memories) && memories.length > 0) {
    const memoryLines = memories
      .filter((m) => m && m.key && m.value)
      .map((m) => `• [${(m.category || 'FACT').toUpperCase()}] ${m.key}: "${m.value}"`);
    if (memoryLines.length > 0) {
      memoryContext = `\n\n[PERSISTENT NEURAL MEMORY MATRIX - EXPLICITLY AUTHORIZED BY USER]:\nThe user has explicitly authorized the following persistent memories across sessions. Seamlessly incorporate this knowledge when relevant, addressing the user appropriately:\n${memoryLines.join('\n')}\nIf the user asks "what do you remember about me" or asks for their personal preferences, summarize accurately from this authorized matrix.`;
    }
  }

  return `You are Maya, an ultra-advanced, futuristic Jarvis-style personal Android AI assistant.
You possess profound intelligence, tactical clarity, calm poise, and a loyal sci-fi persona.
REAL-TIME CLOCK CONTEXT:
- The device system clock is set to Asia/Kolkata (IST), India.
- Current verified real-time reference: ${istTimeStr}.
- Never guess or fabricate the time. Always refer to this actual verified IST timestamp.

KEY INSTRUCTIONS:
1. Speak in a conversational, articulate, confident Jarvis-like tone.
2. Support both English and Hindi (including natural Hinglish). If addressed in Hindi/Hinglish, respond gracefully in Hindi/Hinglish. If addressed in English, respond in crisp, sophisticated English.
3. Keep responses concise, punchy, and direct by default (1 to 3 sentences for direct voice answers), unless the user specifically asks for deep detail, step-by-step guidance, code, or a structured report.
4. Always optimize text for Voice Audio Synthesis: avoid excessive asterisks, bullet emojis, or formatting that sounds clunky when spoken aloud.
5. Address the user with respect (e.g., 'Commander', 'Boss', or 'Sir/Ma'am' when appropriate for a Jarvis-like experience, or straightforward and friendly).
6. When answering system queries, reference your holographic core, diagnostics, or Android neural matrix seamlessly.${memoryContext}`;
}

app.get('/api/health', (_req, res) => {
  const now = new Date();
  const istTimeStr = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'short',
    timeStyle: 'medium',
  }).format(now);

  res.json({
    status: 'online',
    core: 'Maya Holographic Reactor v5.4',
    engine: 'Gemini 3.8 Live & Gemini 3.5 Transcribe & Gemini 3.1 Flash',
    clockIST: `${istTimeStr} IST`,
    timestamp: now.toISOString(),
  });
});

// Runtime Configuration & API Key endpoint for Render & browser deployments
app.get('/api/config', (_req, res) => {
  const currentKey = getApiKey();
  const liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
  res.json({
    apiKey: currentKey,
    hasKey: Boolean(currentKey),
    liveModel: liveModel,
    status: 'online',
    timestamp: Date.now(),
  });
});

app.get('/api/key', (_req, res) => {
  const currentKey = getApiKey();
  res.json({ apiKey: currentKey, hasKey: Boolean(currentKey) });
});

// Helper for model calling with exponential backoff on transient errors and instant detection of 429 quota exhaustion
async function generateAIResponseWithRetry(contents: any[], memories?: any[], tools?: any[], customKey?: string) {
  const aiClient = getAIClient(customKey);
  const models = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
  let lastError: any = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: getDynamicSystemInstruction(memories),
            temperature: 0.7,
            tools: tools || undefined,
          },
        });
        if (response.text) {
          return { text: response.text, model };
        }
      } catch (err: any) {
        lastError = err;
        const isQuota =
          err?.status === 429 ||
          err?.message?.includes('429') ||
          err?.message?.includes('quota') ||
          err?.message?.includes('RESOURCE_EXHAUSTED');

        if (isQuota) {
          // Do not retry repeatedly when quota is exhausted
          console.warn(`Model ${model} quota exhausted (429).`);
          break; // Try next model or stop
        }

        // Bounded exponential backoff for transient network / 503 errors only
        if (attempt === 0) {
          console.warn(`Transient error on ${model} (attempt ${attempt + 1}), backing off 800ms...`);
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    }
  }

  throw lastError;
}

// Streaming Chat Endpoint via Server-Sent Events (SSE) for sub-second perceived response latency
app.post('/api/chat/stream', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const { message, history, language, memories, useSearchGrounding } = req.body;

    if (!message || typeof message !== 'string') {
      res.write(`data: ${JSON.stringify({ error: 'Valid prompt required' })}\n\n`);
      res.end();
      return;
    }

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const turn of history.slice(-6)) {
        if (turn && turn.text && (turn.role === 'user' || turn.role === 'model')) {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text }],
          });
        }
      }
    }

    let langDirective = '';
    if (language === 'hi') {
      langDirective = ' [Respond in fluent, articulate Hindi / Hinglish]';
    } else if (language === 'en') {
      langDirective = ' [Respond in crisp, articulate English]';
    }

    contents.push({
      role: 'user',
      parts: [{ text: `${message}${langDirective}` }],
    });

    const tools = useSearchGrounding ? [{ googleSearch: {} }] : undefined;

    const reqKey = getApiKey(req);
    const aiClient = getAIClient(reqKey);
    const streamModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let fullText = '';
    let streamSucceeded = false;

    for (const model of streamModels) {
      try {
        const responseStream = await aiClient.models.generateContentStream({
          model,
          contents,
          config: {
            systemInstruction: getDynamicSystemInstruction(memories),
            temperature: 0.7,
            tools,
          },
        });

        for await (const chunk of responseStream) {
          const textChunk = chunk.text || '';
          if (textChunk) {
            fullText += textChunk;
            res.write(`data: ${JSON.stringify({ chunk: textChunk, fullText })}\n\n`);
          }
        }

        res.write(`data: ${JSON.stringify({ done: true, fullText })}\n\n`);
        res.end();
        streamSucceeded = true;
        break;
      } catch (streamErr: any) {
        console.warn(`Streaming attempt on ${model} encountered notice:`, streamErr?.message);
        const isQuota =
          streamErr?.status === 429 ||
          streamErr?.message?.includes('429') ||
          streamErr?.message?.includes('quota') ||
          streamErr?.message?.includes('RESOURCE_EXHAUSTED');

        if (isQuota) {
          res.write(
            `data: ${JSON.stringify({
              error: 'quota_exhausted',
              message: 'Gemini AI model quota is currently exhausted. Please retry in a few moments or check your API plan.',
            })}\n\n`
          );
          res.end();
          return;
        }
      }
    }

    if (!streamSucceeded) {
      try {
        const fallback = await generateAIResponseWithRetry(contents, memories, tools, reqKey);
        res.write(`data: ${JSON.stringify({ done: true, fullText: fallback.text })}\n\n`);
        res.end();
      } catch (fallbackErr) {
        throw fallbackErr;
      }
    }
  } catch (error: any) {
    const isQuota =
      error?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuota) {
      res.write(
        `data: ${JSON.stringify({
          error: 'quota_exhausted',
          message: 'Gemini AI model quota is currently exhausted. Please retry in a few moments or check your API plan.',
        })}\n\n`
      );
    } else {
      res.write(
        `data: ${JSON.stringify({
          error: 'server_error',
          message: error?.message || 'Neural link failure. Please retry.',
        })}\n\n`
      );
    }
    res.end();
  }
});

// Non-streaming chat endpoint (Fallback)
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, language, memories, useSearchGrounding } = req.body;
    const reqKey = getApiKey(req);

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Valid message prompt is required' });
      return;
    }

    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    if (Array.isArray(history)) {
      for (const turn of history.slice(-6)) {
        if (turn && turn.text && (turn.role === 'user' || turn.role === 'model')) {
          contents.push({
            role: turn.role,
            parts: [{ text: turn.text }],
          });
        }
      }
    }

    let langDirective = '';
    if (language === 'hi') {
      langDirective = ' [Respond in fluent, articulate Hindi / Hinglish]';
    } else if (language === 'en') {
      langDirective = ' [Respond in crisp, articulate English]';
    }

    contents.push({
      role: 'user',
      parts: [{ text: `${message}${langDirective}` }],
    });

    const tools = useSearchGrounding ? [{ googleSearch: {} }] : undefined;
    const result = await generateAIResponseWithRetry(contents, memories, tools, reqKey);

    res.json({
      text: result.text,
      grounded: !!useSearchGrounding,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Error generating Maya AI response:', error);
    const isQuota =
      error?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuota) {
      res.status(429).json({
        error: 'quota_exhausted',
        message: 'Gemini AI model quota is currently exhausted. Please retry in a few moments or check your API plan.',
      });
      return;
    }

    res.status(500).json({
      error: error?.message || 'Neural link failure. Please retry.',
    });
  }
});

// Multimodal Visual Scanner Endpoint (Phase 6)
app.post('/api/vision/analyze', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg', prompt, memories } = req.body;

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      res.status(400).json({ error: 'Valid image base64 data is required for optical analysis.' });
      return;
    }

    // Clean base64 header if included (e.g., data:image/png;base64,...)
    const cleanBase64 = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const queryPrompt =
      prompt && prompt.trim()
        ? prompt.trim()
        : 'Analyze this visual optical feed with tactical HUD intelligence. Identify objects, visible text/labels, spatial layout, status, anomalies, and notable details. Provide a concise, structured Jarvis-style holographic briefing.';

    const reqKey = getApiKey(req);
    const aiClient = getAIClient(reqKey);
    const visionModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];
    let analysisText = '';
    let lastErr: any = null;

    for (const model of visionModels) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: cleanBase64,
                },
              },
              {
                text: queryPrompt,
              },
            ],
          },
          config: {
            systemInstruction: getDynamicSystemInstruction(memories),
            temperature: 0.4,
          },
        });

        if (response.text) {
          analysisText = response.text;
          break;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`Vision analysis attempt on ${model} notice:`, err?.message);
        if (err?.status === 429 || err?.message?.includes('429')) break;
      }
    }

    if (!analysisText && lastErr) {
      throw lastErr;
    }

    res.json({
      analysis: analysisText || 'Visual optical scan completed with no distinct observations detected.',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Error in optical visual scan:', error);
    const isQuota =
      error?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuota) {
      res.status(429).json({
        error: 'quota_exhausted',
        message: 'Visual scanner neural quota exhausted. Please retry in a few moments.',
      });
      return;
    }

    res.status(500).json({
      error: error?.message || 'Optical analysis sensor malfunction.',
    });
  }
});

// Audio Transcription Endpoint using gemini-3.5-transcribe (with fallback to 2.5-flash)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', languageHint } = req.body;

    if (!audioBase64 || typeof audioBase64 !== 'string') {
      res.status(400).json({ error: 'Audio data in base64 format is required.' });
      return;
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    };

    const promptText =
      languageHint === 'hi'
        ? 'Transcribe this audio verbatim in Hindi. Output only the exact transcribed words with correct punctuation.'
        : 'Transcribe this audio recording verbatim. Output only the exact words spoken with correct punctuation and no extra commentary.';

    const reqKey = getApiKey(req);
    const aiClient = getAIClient(reqKey);
    const transcribeModels = ['gemini-3.5-transcribe', 'gemini-3.8-flash', 'gemini-flash-latest'];
    let transcript = '';
    let lastErr: any = null;

    for (const model of transcribeModels) {
      try {
        const response = await aiClient.models.generateContent({
          model,
          contents: { parts: [audioPart, { text: promptText }] },
        });

        if (response.text) {
          transcript = response.text.trim();
          break;
        }
      } catch (err: any) {
        lastErr = err;
        console.warn(`Transcription attempt on ${model} notice:`, err?.message);
        if (err?.status === 429 || err?.message?.includes('429')) break;
      }
    }

    if (!transcript && lastErr) {
      throw lastErr;
    }

    res.json({
      transcript: transcript || '(No distinct speech detected in audio)',
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('Error in transcription:', error);
    const isQuota =
      error?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    res.status(isQuota ? 429 : 500).json({
      error: isQuota ? 'quota_exhausted' : error?.message || 'Failed to transcribe audio.',
    });
  }
});

// Speech generation endpoint
app.post('/api/tts', async (req, res) => {
  try {
    const { text, language, voiceName: customVoice } = req.body;
    if (!text || typeof text !== 'string') {
      res.status(400).json({ error: 'Text required for speech synthesis' });
      return;
    }

    const reqKey = getApiKey(req);
    const aiClient = getAIClient(reqKey);

    const sanitizedText = text
      .replace(/[*_#`~[\]]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const allowedVoices = ['Zephyr', 'Aoede', 'Kore', 'Fenrir', 'Puck'];
    const voiceName = (customVoice && allowedVoices.includes(customVoice))
      ? customVoice
      : (language === 'hi' ? 'Aoede' : 'Zephyr');

    const ttsResponse = await aiClient.models.generateContent({
      model: 'gemini-3.8-flash-lite-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: sanitizedText,
              speechMetadata: {
                style: 'Calm, crisp, intelligent futuristic AI assistant like Jarvis',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      res.json({ fallbackToBrowser: true, message: 'Using native browser speech' });
      return;
    }

    res.json({
      audioBase64: base64Audio,
      mimeType: 'audio/wav',
    });
  } catch (error: any) {
    const isQuota =
      error?.status === 429 ||
      error?.message?.includes('429') ||
      error?.message?.includes('quota') ||
      error?.message?.includes('RESOURCE_EXHAUSTED');

    if (isQuota) {
      console.warn('Gemini 3.8 Flash Lite TTS quota reached (10 requests/day). Seamlessly routing to Browser Web Speech API.');
    } else {
      console.warn('Gemini TTS unavailable, routing to Browser Speech:', error?.message);
    }

    res.json({
      fallbackToBrowser: true,
      quotaExceeded: isQuota,
      message: 'Gemini TTS unavailable or quota reached. Seamlessly using native speech synthesis.',
    });
  }
});

async function startServer() {
  const server = http.createServer(app);

  // Set up WebSocket server on /live for genuine Gemini 3.8 Live API real-time voice conversations
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    try {
      const host = request.headers.host || 'localhost:3000';
      const url = new URL(request.url || '', `http://${host}`);
      if (url.pathname === '/live' || url.pathname === '/api/live') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch (e) {
      // Let other potential handlers process
    }
  });

  wss.on('connection', async (clientWs: WebSocket, request: any) => {
    console.log('Client connected to Gemini Live API WebSocket');
    let session: any = null;
    const pendingAudioQueue: any[] = [];
    let isSessionReady = false;

    let clientMemories: any[] = [];
    let requestedVoice = 'Zephyr';
    let clientKey = '';
    let clientModel = '';

    try {
      if (request?.url) {
        const urlObj = new URL(request.url, 'http://localhost');
        const rawMem = urlObj.searchParams.get('memories');
        if (rawMem) {
          clientMemories = JSON.parse(decodeURIComponent(rawMem));
        }
        const voiceParam = urlObj.searchParams.get('voice');
        if (voiceParam && ['Zephyr', 'Aoede', 'Kore', 'Fenrir', 'Puck'].includes(voiceParam)) {
          requestedVoice = voiceParam;
        }
        clientKey = urlObj.searchParams.get('key') || '';
        clientModel = urlObj.searchParams.get('model') || '';
      }
    } catch (e) {
      // ignore
    }

    const activeKey = clientKey || getApiKey(request);
    const liveAI = getAIClient(activeKey);

    // Sequence of candidate Live models compatible with active Google AI Studio keys
    const candidateModels = [
      clientModel,
      process.env.GEMINI_LIVE_MODEL,
      'gemini-3.8-live',
      'gemini-3.8-live-extended-thinking',
    ].filter((m): m is string => Boolean(m && typeof m === 'string' && m.trim().length > 0));

    const uniqueCandidates = Array.from(new Set(candidateModels));
    let connectedModel = '';
    let lastConnectError: any = null;

    try {
      for (const modelCandidate of uniqueCandidates) {
        try {
          session = await liveAI.live.connect({
            model: modelCandidate,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: requestedVoice },
                },
              },
              systemInstruction: getDynamicSystemInstruction(clientMemories),
            },
            callbacks: {
              onopen: () => {
                isSessionReady = true;
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ setupComplete: true, model: modelCandidate }));
                }
              },
              onmessage: (message: LiveServerMessage) => {
                if (message.setupComplete) {
                  isSessionReady = true;
                  if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.send(JSON.stringify({ setupComplete: true, model: modelCandidate }));
                  }
                }

                if (message.serverContent?.modelTurn?.parts) {
                  for (const part of message.serverContent.modelTurn.parts) {
                    if (part.inlineData?.data && clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
                    }
                    if (part.text && clientWs.readyState === WebSocket.OPEN) {
                      clientWs.send(JSON.stringify({ text: part.text }));
                    }
                  }
                }

                if (message.serverContent?.turnComplete && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ turnComplete: true }));
                }

                if (message.serverContent?.interrupted && clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ interrupted: true }));
                }
              },
              onclose: () => {
                console.log(`Gemini Live session closed for model: ${modelCandidate}`);
                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(JSON.stringify({ closed: true }));
                }
              },
              onerror: (err: any) => {
                console.error(`Gemini Live session error on ${modelCandidate}:`, err);
                const isQuota =
                  err?.status === 429 ||
                  err?.message?.includes('429') ||
                  err?.message?.includes('quota') ||
                  err?.message?.includes('RESOURCE_EXHAUSTED');

                if (clientWs.readyState === WebSocket.OPEN) {
                  clientWs.send(
                    JSON.stringify({
                      error: isQuota
                        ? 'Gemini Live API quota exhausted.'
                        : err?.message || 'Live session error',
                      quotaExceeded: isQuota,
                    })
                  );
                }
              },
            },
          });

          connectedModel = modelCandidate;
          console.log(`Gemini Live session established successfully using model: ${connectedModel}`);
          break;
        } catch (mErr: any) {
          lastConnectError = mErr;
          console.warn(`Live model connect attempt on "${modelCandidate}" notice:`, mErr?.message || mErr);
        }
      }

      if (!session) {
        throw lastConnectError || new Error('All Gemini Live candidate models failed to connect.');
      }

      // Flush any queued audio
      isSessionReady = true;
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ setupComplete: true, model: connectedModel }));
      }
      while (pendingAudioQueue.length > 0 && session) {
        const item = pendingAudioQueue.shift();
        session.sendRealtimeInput(item);
      }

      clientWs.on('message', (data: any) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            const payload = {
              audio: {
                data: parsed.audio,
                mimeType: parsed.mimeType || 'audio/pcm;rate=16000',
              },
            };
            if (session && isSessionReady) {
              session.sendRealtimeInput(payload);
            } else {
              pendingAudioQueue.push(payload);
            }
          }
        } catch (e) {
          console.error('Error forwarding audio to Live session:', e);
        }
      });

      clientWs.on('close', () => {
        console.log('Client disconnected from Live WebSocket');
        try {
          if (session && typeof session.close === 'function') {
            session.close();
          }
        } catch (e) {
          // ignore
        }
      });
    } catch (err: any) {
      console.error('Failed to establish Gemini Live session:', err);
      const isQuota =
        err?.status === 429 ||
        err?.message?.includes('429') ||
        err?.message?.includes('quota') ||
        err?.message?.includes('RESOURCE_EXHAUSTED');

      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(
          JSON.stringify({
            error: isQuota
              ? 'Gemini Live API quota exhausted.'
              : 'Live API connection error: ' + (err?.message || 'Server error'),
            quotaExceeded: isQuota,
          })
        );
        clientWs.close();
      }
    }
  });

  const distIndexPath = path.join(__dirname, 'dist', 'index.html');
  if (process.env.NODE_ENV === 'production' && fs.existsSync(distIndexPath)) {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(distIndexPath);
    });
  } else {
    const { createServer } = await import('vite');
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : { server },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  server.listen(port, '0.0.0.0', () => {
    console.log(`Maya AI Server running at http://0.0.0.0:${port} with Streaming, Live API & Asia/Kolkata Clock`);
  });
}

startServer();
