import { useRef, useState, useCallback, useEffect } from 'react';
import { api } from '@/api/client';

export type CallStatus = 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended';

export interface IncomingCall {
  callId: string;
  fromUserId: number;
  fromName: string;
  fromAvatar: string;
  type: 'voice' | 'video';
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export interface CallEndInfo {
  type: 'voice' | 'video';
  duration: number; // секунды, 0 если не был принят
  missed: boolean;
}

export function useWebRTC(
  currentUserId: number | null,
  onCallEnd?: (info: CallEndInfo) => void,
) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string>('');
  const peerUserIdRef = useRef<number>(0);
  const callTypeRef = useRef<'voice' | 'video'>('voice');
  const afterIdRef = useRef<number>(0);
  const callStartTimeRef = useRef<number>(0); // unix ms когда стало active
  const onCallEndRef = useRef(onCallEnd);
  onCallEndRef.current = onCallEnd;

  // Очередь ICE-кандидатов до setRemoteDescription
  const iceCandidateQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSetRef = useRef<boolean>(false);

  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  // Отдельный polling timer — НЕ трогается при cleanup звонка
  const sigPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Аудио для голоса (не видео — там srcObject на <video>)
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    (audio as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
    remoteAudioRef.current = audio;
    return () => { audio.srcObject = null; };
  }, []);

  // Аудио воспроизведение только для голосовых звонков
  useEffect(() => {
    if (remoteStream && callTypeRef.current === 'voice' && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const stopStream = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const cleanup = useCallback(async (callId?: string, missed = false) => {
    // Сбрасываем PCref ДО закрытия, чтобы ontrack/onicecandidate не сработали
    const pc = pcRef.current;
    pcRef.current = null;
    pc?.close();

    stopStream();
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setRemoteStream(null);

    iceCandidateQueueRef.current = [];
    remoteDescSetRef.current = false;

    const cid = callId || callIdRef.current;
    const endedType = callTypeRef.current;
    const duration = callStartTimeRef.current
      ? Math.round((Date.now() - callStartTimeRef.current) / 1000)
      : 0;
    callStartTimeRef.current = 0;

    callIdRef.current = '';
    peerUserIdRef.current = 0;
    pendingOfferRef.current = null;

    if (cid) {
      try { await api.clearSignals(cid); } catch { /* ignore */ }
    }

    // Уведомляем о завершении звонка
    onCallEndRef.current?.({ type: endedType, duration, missed });

    setStatus('ended');
    setTimeout(() => setStatus('idle'), 1500);
  }, [stopStream]);

  const flushIceCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc) return;
    const queue = iceCandidateQueueRef.current.splice(0);
    for (const c of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  }, []);

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && peerUserIdRef.current) {
        api.sendSignal(
          callIdRef.current,
          peerUserIdRef.current,
          'ice-candidate',
          e.candidate.toJSON()
        ).catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? new MediaStream([e.track]);
      setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] connectionState:', pc.connectionState);
      if (pc.connectionState === 'failed') cleanup();
    };

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] iceGatheringState:', pc.iceGatheringState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] iceConnectionState:', pc.iceConnectionState);
    };

    pcRef.current = pc;
    remoteDescSetRef.current = false;
    iceCandidateQueueRef.current = [];
    return pc;
  }, [cleanup]);

  const getMedia = async (type: 'voice' | 'video') => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } : false,
    });
    localStreamRef.current = stream;
    setLocalStream(stream);
    return stream;
  };

  // Исходящий звонок
  const startCall = useCallback(async (
    toUserId: number,
    type: 'voice' | 'video',
    callId: string,
  ) => {
    if (!currentUserId) return;
    callIdRef.current = callId;
    peerUserIdRef.current = toUserId;
    callTypeRef.current = type;
    setStatus('outgoing');

    try {
      const stream = await getMedia(type);
      const pc = createPc();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await api.sendSignal(callId, toUserId, 'offer', {
        sdp: offer.sdp,
        type: offer.type,
        callType: type,
      });
    } catch (e) {
      console.error('[WebRTC] startCall error:', e);
      cleanup();
    }
  }, [currentUserId, createPc, cleanup]);

  // Принять входящий звонок
  const acceptCall = useCallback(async (incoming: IncomingCall) => {
    const offer = pendingOfferRef.current;
    if (!offer) {
      console.error('[WebRTC] acceptCall: no pending offer');
      return;
    }
    callIdRef.current = incoming.callId;
    peerUserIdRef.current = incoming.fromUserId;
    callTypeRef.current = incoming.type;
    setIncomingCall(null);
    setStatus('active');

    try {
      const stream = await getMedia(incoming.type);
      const pc = createPc();
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      remoteDescSetRef.current = true;

      // Применяем накопленные ICE кандидаты
      await flushIceCandidates();

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await api.sendSignal(incoming.callId, incoming.fromUserId, 'answer', {
        sdp: answer.sdp,
        type: answer.type,
      });
      pendingOfferRef.current = null;
      callStartTimeRef.current = Date.now();
    } catch (e) {
      console.error('[WebRTC] acceptCall error:', e);
      cleanup();
    }
  }, [createPc, cleanup, flushIceCandidates]);

  const hangUp = useCallback(async () => {
    if (peerUserIdRef.current) {
      await api.sendSignal(callIdRef.current, peerUserIdRef.current, 'hang-up', {}).catch(() => {});
    }
    setIncomingCall(null);
    cleanup();
  }, [cleanup]);

  const rejectCall = useCallback(async (incoming: IncomingCall) => {
    await api.sendSignal(incoming.callId, incoming.fromUserId, 'reject', {}).catch(() => {});
    setIncomingCall(null);
  }, []);

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(prev => !prev);
  }, []);

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(prev => !prev);
  }, []);

  // Обработка сигналов
  const handleSignal = useCallback(async (sig: {
    id: number; call_id: string; from_user_id: number; type: string; payload: unknown;
  }) => {
    afterIdRef.current = Math.max(afterIdRef.current, sig.id);

    if (sig.type === 'ring') {
      const p = sig.payload as { callType?: string; fromName?: string; fromAvatar?: string };
      setIncomingCall({
        callId: sig.call_id,
        fromUserId: sig.from_user_id,
        fromName: p.fromName || 'Пользователь',
        fromAvatar: p.fromAvatar || '1',
        type: (p.callType as 'voice' | 'video') || 'voice',
      });
      return;
    }

    if (sig.type === 'offer') {
      const p = sig.payload as { sdp: string; type: string; callType?: string };
      pendingOfferRef.current = { sdp: p.sdp, type: p.type as RTCSdpType };
      setIncomingCall(prev => prev ? { ...prev, type: (p.callType as 'voice' | 'video') || 'voice' } : {
        callId: sig.call_id,
        fromUserId: sig.from_user_id,
        fromName: 'Пользователь',
        fromAvatar: '1',
        type: (p.callType as 'voice' | 'video') || 'voice',
      });
      return;
    }

    if (sig.type === 'answer') {
      const pc = pcRef.current;
      if (!pc) return;
      const p = sig.payload as RTCSessionDescriptionInit;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(p));
        remoteDescSetRef.current = true;
        callStartTimeRef.current = Date.now();
        // Применяем накопленные кандидаты
        await flushIceCandidates();
        setStatus('active');
      } catch (e) {
        console.error('[WebRTC] setRemoteDescription(answer) error:', e);
      }
      return;
    }

    if (sig.type === 'ice-candidate') {
      const candidate = sig.payload as RTCIceCandidateInit;
      if (remoteDescSetRef.current && pcRef.current) {
        // Remote description уже установлен — применяем сразу
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch { /* ignore */ }
      } else {
        // Кладём в очередь — применим после setRemoteDescription
        iceCandidateQueueRef.current.push(candidate);
      }
      return;
    }

    if (sig.type === 'reject') {
      setIncomingCall(null);
      cleanup(sig.call_id, true); // пропущенный
    }

    if (sig.type === 'hang-up') {
      setIncomingCall(null);
      cleanup(sig.call_id, false);
    }
  }, [cleanup, flushIceCandidates]);

  // Polling сигналов — живёт независимо от звонка
  const handleSignalRef = useRef(handleSignal);
  handleSignalRef.current = handleSignal;

  useEffect(() => {
    if (!currentUserId) return;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const data = await api.pollSignals(afterIdRef.current);
        const signals = (data.signals ?? []) as Parameters<typeof handleSignal>[0][];
        for (const sig of signals) {
          await handleSignalRef.current(sig);
        }
      } catch { /* ignore */ }
      if (!stopped) sigPollTimerRef.current = setTimeout(poll, 1000);
    };

    // Первый запрос — получаем текущий max id, не обрабатываем старые сигналы
    api.pollSignals(0).then((data) => {
      const sigs = (data.signals ?? []) as { id: number }[];
      if (sigs.length > 0) {
        afterIdRef.current = Math.max(...sigs.map(s => s.id));
      }
    }).catch(() => {}).finally(() => {
      if (!stopped) poll();
    });

    return () => {
      stopped = true;
      if (sigPollTimerRef.current) clearTimeout(sigPollTimerRef.current);
    };
  }, [currentUserId]);

  return {
    status,
    callType: callTypeRef.current,
    incomingCall,
    isMuted,
    isCameraOff,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    hangUp,
    rejectCall,
    toggleMute,
    toggleCamera,
  };
}