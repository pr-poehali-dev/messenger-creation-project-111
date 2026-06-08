import { useRef, useState, useCallback, useEffect } from 'react';
import { api } from '@/api/client';

export type CallStatus =
  | 'idle'
  | 'outgoing'   // мы звоним, ждём ответа
  | 'incoming'   // нам звонят
  | 'active'     // звонок идёт
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
];

export function useWebRTC(currentUserId: number | null) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const callIdRef = useRef<string>('');
  const peerUserIdRef = useRef<number>(0);
  const callTypeRef = useRef<'voice' | 'video'>('voice');
  const afterIdRef = useRef<number>(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pendingOfferRef = useRef<RTCSessionDescriptionInit | null>(null);

  const stopStream = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
  };

  const closePc = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  const cleanup = useCallback(async (callId?: string) => {
    stopStream();
    closePc();
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    const cid = callId || callIdRef.current;
    if (cid) {
      try { await api.clearSignals(cid); } catch { /* ignore */ }
    }
    callIdRef.current = '';
    peerUserIdRef.current = 0;
    setStatus('ended');
    setTimeout(() => setStatus('idle'), 1500);
  }, [closePc]);

  const createPc = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    pc.onicecandidate = (e) => {
      if (e.candidate && peerUserIdRef.current) {
        api.sendSignal(callIdRef.current, peerUserIdRef.current, 'ice-candidate', e.candidate).catch(() => {});
      }
    };

    pc.ontrack = (e) => {
      remoteStreamRef.current = e.streams[0];
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = e.streams[0];
      }
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
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: type === 'video' ? { facingMode: 'user' } : false,
    });
    localStreamRef.current = stream;
    if (localVideoRef.current && type === 'video') {
      localVideoRef.current.srcObject = stream;
    }
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

      await api.sendSignal(callId, toUserId, 'offer', { sdp: offer.sdp, type: offer.type, callType: type });
    } catch (e) {
      console.error('startCall error', e);
      cleanup();
    }
  }, [currentUserId, createPc, cleanup]);

  // Принять входящий звонок
  const acceptCall = useCallback(async (incoming: IncomingCall) => {
    const offer = pendingOfferRef.current;
    if (!offer) return;
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

      await api.sendSignal(incoming.callId, incoming.fromUserId, 'answer', { sdp: answer.sdp, type: answer.type });
      pendingOfferRef.current = null;
    } catch (e) {
      console.error('acceptCall error', e);
      cleanup();
    }
  }, [createPc, cleanup]);

  // Отклонить/завершить звонок
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

  // Управление звуком/камерой
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
      const p = sig.payload as { sdp: string; type: string; callType?: string; fromName?: string; fromAvatar?: string };
      pendingOfferRef.current = { sdp: p.sdp, type: p.type as RTCSdpType };
      setIncomingCall(prev => prev ? { ...prev } : {
        callId: sig.call_id,
        fromUserId: sig.from_user_id,
        fromName: p.fromName || 'Пользователь',
        fromAvatar: p.fromAvatar || '1',
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
      } catch { /* ignore race condition */ }
      return;
    }

    if (sig.type === 'hang-up' || sig.type === 'reject') {
      setIncomingCall(null);
      cleanup(sig.call_id);
      return;
    }
  }, [cleanup]);

  // Polling сигналов
  const poll = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const data = await api.pollSignals(afterIdRef.current);
      for (const sig of (data.signals as typeof data.signals)) {
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
    localVideoRef,
    remoteVideoRef,
    localStream: localStreamRef,
    remoteStream: remoteStreamRef,
    startCall,
    acceptCall,
    hangUp,
    rejectCall,
    toggleMute,
    toggleCamera,
    _pendingOffer: pendingOfferRef,
  };
}