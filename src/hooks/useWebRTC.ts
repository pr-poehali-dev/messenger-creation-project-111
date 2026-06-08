import { useRef, useState, useCallback, useEffect } from 'react';
import { api } from '@/api/client';

export type CallStatus =
  | 'idle'
  | 'outgoing'
  | 'incoming'
  | 'active'
  | 'ended';

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
];

export function useWebRTC(currentUserId: number | null) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  // Храним remoteStream в state чтобы триггерить ре-рендер когда он появляется
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string>('');
  const peerUserIdRef = useRef<number>(0);
  const callTypeRef = useRef<'voice' | 'video'>('voice');
  const afterIdRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  // Аудио элемент для воспроизведения удалённого потока
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);

  // Создаём audio элемент один раз
  useEffect(() => {
    const audio = new Audio();
    audio.autoplay = true;
    audio.playsInline = true;
    remoteAudioRef.current = audio;
    return () => {
      audio.srcObject = null;
    };
  }, []);

  // Когда появляется remoteStream — подключаем к audio
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const stopStream = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    setLocalStream(null);
  };

  const closePc = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const cleanup = useCallback(async (callId?: string) => {
    stopStream();
    closePc();
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    setRemoteStream(null);
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const cid = callId || callIdRef.current;
    if (cid) {
      try { await api.clearSignals(cid); } catch { /* ignore */ }
    }
    callIdRef.current = '';
    peerUserIdRef.current = 0;
    pendingOfferRef.current = null;
    setStatus('ended');
    setTimeout(() => setStatus('idle'), 1500);
  }, [closePc]);

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && peerUserIdRef.current) {
        api.sendSignal(callIdRef.current, peerUserIdRef.current, 'ice-candidate', e.candidate.toJSON()).catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      setRemoteStream(stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        cleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }, [cleanup]);

  const getMedia = async (type: 'voice' | 'video') => {
    const constraints: MediaStreamConstraints = {
      audio: { echoCancellation: true, noiseSuppression: true },
      video: type === 'video' ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } : false,
    };
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
      console.error('startCall error:', e);
      setStatus('idle');
    }
  }, [currentUserId, createPc]);

  // Принять входящий звонок
  const acceptCall = useCallback(async (incoming: IncomingCall) => {
    const offer = pendingOfferRef.current;
    if (!offer) {
      console.error('acceptCall: no pending offer');
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
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await api.sendSignal(incoming.callId, incoming.fromUserId, 'answer', {
        sdp: answer.sdp,
        type: answer.type,
      });
      pendingOfferRef.current = null;
    } catch (e) {
      console.error('acceptCall error:', e);
      cleanup();
    }
  }, [createPc, cleanup]);

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

  // Обработка входящих сигналов
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
      const p = sig.payload as { sdp: string; type: string; callType?: string; fromName?: string };
      pendingOfferRef.current = { sdp: p.sdp, type: p.type as RTCSdpType };
      setIncomingCall(prev => prev ? { ...prev } : {
        callId: sig.call_id,
        fromUserId: sig.from_user_id,
        fromName: p.fromName || 'Пользователь',
        fromAvatar: '1',
        type: (p.callType as 'voice' | 'video') || 'voice',
      });
      return;
    }

    if (sig.type === 'answer' && pcRef.current) {
      const p = sig.payload as RTCSessionDescriptionInit;
      await pcRef.current.setRemoteDescription(new RTCSessionDescription(p));
      setStatus('active');
      return;
    }

    if (sig.type === 'ice-candidate' && pcRef.current) {
      try {
        await pcRef.current.addIceCandidate(new RTCIceCandidate(sig.payload as RTCIceCandidateInit));
      } catch { /* ignore */ }
      return;
    }

    if (sig.type === 'hang-up' || sig.type === 'reject') {
      setIncomingCall(null);
      cleanup(sig.call_id);
      return;
    }
  }, [cleanup]);

  // Polling
  const poll = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await api.pollSignals(afterIdRef.current);
      for (const sig of (data.signals as Parameters<typeof handleSignal>[0][])) {
        await handleSignal(sig);
      }
    } catch { /* ignore */ }
    pollTimerRef.current = setTimeout(poll, 2000);
  }, [currentUserId, handleSignal]);

  useEffect(() => {
    if (!currentUserId) return;
    poll();
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, [currentUserId, poll]);

  return {
    status,
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
    _pendingOffer: pendingOfferRef,
  };
}
