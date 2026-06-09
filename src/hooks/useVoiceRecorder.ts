import { useRef, useState, useCallback } from 'react';

export interface VoiceRecording {
  blob: Blob;
  url: string;
  duration: number;
  mimeType: string;
}

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [recording, setRecording] = useState<VoiceRecording | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const getMimeType = () => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/ogg',
      'audio/mp4',
    ];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || 'audio/webm';
  };

  const start = useCallback(async () => {
    setRecording(null);
    chunksRef.current = [];

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = getMimeType();
    const mr = new MediaRecorder(stream, { mimeType });

    mr.ondataavailable = e => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const dur = Math.round((Date.now() - startTimeRef.current) / 1000);
      setRecording({ blob, url, duration: dur, mimeType });
      setDuration(0);
    };

    mediaRecorderRef.current = mr;
    startTimeRef.current = Date.now();
    mr.start(200);
    setIsRecording(true);

    timerRef.current = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 500);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setDuration(0);
    setRecording(null);
  }, []);

  const clear = useCallback(() => {
    setRecording(null);
  }, []);

  return { isRecording, duration, recording, start, stop, cancel, clear };
}
