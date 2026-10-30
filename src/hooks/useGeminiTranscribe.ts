import { useState, useRef, useCallback } from 'react';
import { LanguageMode } from '../types';
import { getApiHeaders, getRuntimeApiKey } from '../utils/runtimeConfig';

interface UseGeminiTranscribeProps {
  language: LanguageMode;
  onTranscriptComplete?: (transcript: string) => void;
}

export function useGeminiTranscribe({
  language,
  onTranscriptComplete,
}: UseGeminiTranscribeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    setRecordingDuration(0);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(250); // Slice chunks every 250ms
      setIsRecording(true);

      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 500);
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      setError('Could not access microphone for transcription.');
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(async () => {
    if (!mediaRecorderRef.current || !isRecording) return;

    clearInterval(timerRef.current);
    setIsRecording(false);
    setIsTranscribing(true);

    const mediaRecorder = mediaRecorderRef.current;

    return new Promise<string>((resolve, reject) => {
      mediaRecorder.onstop = async () => {
        try {
          // Stop media stream tracks
          mediaRecorder.stream.getTracks().forEach((track) => track.stop());

          const mimeType = mediaRecorder.mimeType || 'audio/webm';
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

          if (audioBlob.size < 100) {
            throw new Error('Recording was too short or empty.');
          }

          // Convert blob to base64
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const dataUrl = reader.result as string;
            const base64Data = dataUrl.split(',')[1];

            try {
              const res = await fetch('/api/transcribe', {
                method: 'POST',
                headers: getApiHeaders(),
                body: JSON.stringify({
                  audioBase64: base64Data,
                  mimeType: mimeType.split(';')[0],
                  languageHint: language,
                  apiKey: getRuntimeApiKey(),
                }),
              });

              if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error || `Server responded with ${res.status}`);
              }

              const data = await res.json();
              const resultText = data.transcript || '';
              setTranscript(resultText);
              setIsTranscribing(false);
              onTranscriptComplete?.(resultText);
              resolve(resultText);
            } catch (postErr: any) {
              console.error('Transcription API error:', postErr);
              setError(postErr?.message || 'Failed to transcribe audio.');
              setIsTranscribing(false);
              reject(postErr);
            }
          };
        } catch (e: any) {
          console.error('Error processing audio recording:', e);
          setError(e?.message || 'Error processing recorded audio.');
          setIsTranscribing(false);
          reject(e);
        }
      };

      mediaRecorder.stop();
    });
  }, [isRecording, language, onTranscriptComplete]);

  const cancelRecording = useCallback(() => {
    clearInterval(timerRef.current);
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
        mediaRecorderRef.current.stop();
      } catch (e) {
        // ignore
      }
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
    setIsTranscribing(false);
    setRecordingDuration(0);
    audioChunksRef.current = [];
  }, []);

  return {
    isRecording,
    isTranscribing,
    transcript,
    recordingDuration,
    error,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}
