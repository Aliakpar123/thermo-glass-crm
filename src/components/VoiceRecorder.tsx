'use client';

import { useState, useRef, useCallback } from 'react';

interface VoiceRecorderProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SpeechRecognitionAny = any;

export default function VoiceRecorder({ onTranscript, disabled }: VoiceRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const recognitionRef = useRef<SpeechRecognitionAny | null>(null);
  // храним накопленный текст в ref, чтобы onend точно видел актуальное значение
  const finalRef = useRef<string>('');
  const interimRef = useRef<string>('');

  const startRecording = useCallback(async () => {
    setErrorMsg('');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setErrorMsg('Браузер не поддерживает голосовой ввод. Используйте Chrome или Edge.');
      return;
    }

    // Запрашиваем доступ к микрофону заранее — иначе в некоторых браузерах
    // SpeechRecognition падает с 'not-allowed' без внятной причины.
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setErrorMsg('Разрешите доступ к микрофону в настройках браузера');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.continuous = false; // надёжнее на Chrome — одна фраза за раз
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    finalRef.current = '';
    interimRef.current = '';

    recognition.onresult = (event: SpeechRecognitionAny) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';
        if (result.isFinal) {
          finalChunk += text + ' ';
        } else {
          interim += text;
        }
      }
      if (finalChunk) finalRef.current += finalChunk;
      interimRef.current = interim;
      setTranscript(finalRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionAny) => {
      console.error('Speech recognition error:', event.error);
      const errMap: Record<string, string> = {
        'not-allowed': 'Доступ к микрофону запрещён',
        'service-not-allowed': 'Сервис распознавания недоступен',
        'no-speech': 'Речь не обнаружена. Попробуйте ещё раз',
        'audio-capture': 'Микрофон не найден',
        'network': 'Нет интернета для распознавания',
      };
      setErrorMsg(errMap[event.error] || `Ошибка: ${event.error}`);
    };

    recognition.onend = () => {
      setIsRecording(false);
      // Берём всё, что успели получить: final + interim (если final пустой)
      const text = (finalRef.current.trim() || interimRef.current.trim());
      if (text) {
        onTranscript(text);
        setTranscript('');
        setErrorMsg('');
      } else if (!errorMsg) {
        setErrorMsg('Не удалось распознать речь. Попробуйте ещё раз');
      }
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      setTranscript('');
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setErrorMsg('Не удалось запустить распознавание');
      setIsRecording(false);
    }
  }, [onTranscript, errorMsg]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled}
        className={`p-2 rounded-lg transition-all duration-200 ${
          isRecording
            ? 'bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30 ring-4 ring-red-200'
            : 'bg-red-500 text-white hover:bg-red-600 shadow-sm'
        } disabled:opacity-50`}
        title={isRecording ? 'Остановить запись' : 'Голосовая заметка'}
      >
        {isRecording ? (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 0v4m0 0a3 3 0 01-3-3V5a3 3 0 016 0v7a3 3 0 01-3 3zm-4 4h8m-4-4v4" />
          </svg>
        )}
      </button>

      {isRecording && (
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-fadeIn z-50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            Запись... Говорите
          </div>
          {transcript && (
            <div className="mt-1 text-[10px] opacity-80 max-w-[200px] truncate">
              {transcript}
            </div>
          )}
        </div>
      )}

      {!isRecording && errorMsg && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap animate-fadeIn z-50 max-w-[240px]">
          {errorMsg}
        </div>
      )}
    </div>
  );
}
