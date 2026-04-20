/**
 * useTableChat_v2.js — improved chat hook with optimistic UI and dedupe
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const MAX_MESSAGES = 200;
const MAX_LENGTH = 200;
const CONFIRM_TIMEOUT = 8000;

export function useTableChat(sendChatFn, wsRef = null) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const counterRef = useRef(0);
  const seenRef = useRef(new Set());
  const pendingRef = useRef({});

  const _push = useCallback((from, message, ts, isMe, opts = {}) => {
    const tsIso = ts ? String(ts) : new Date().toISOString();
    const key = `${from}|${tsIso}|${message}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);
    const id = ++counterRef.current;
    setMessages((prev) => {
      const next = [
        ...prev,
        { id, user: from, text: message, ts: tsIso, is_me: !!isMe, ...(opts || {}) },
      ];
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });
  }, []);

  const pushIncoming = useCallback((msg) => {
    const from = msg.from;
    const text = msg.message;
    const ts = msg.ts || new Date().toISOString();
    const isMe = from === (user?.username ?? '');
    if (isMe) {      let confirmed = false;      setMessages((prev) => prev.map((m) => {        if (m.is_me && m.is_pending && m.text === text) {          const tid = pendingRef.current[m.id];          if (tid) { clearTimeout(tid); delete pendingRef.current[m.id]; }          confirmed = true;          return { ...m, user: from, text, ts, is_pending: false, error: false };        }        return m;      }));      if (confirmed) {        seenRef.current.add(`${from}|${ts}|${text}`);        return;      }    }    _push(from, text, ts, isMe);  }, [user, _push]);

  useEffect(() => {    if (!wsRef?.current) return;    const ws = wsRef.current;    const originalOnMessage = ws.onmessage;    ws.onmessage = (e) => {      if (originalOnMessage) originalOnMessage(e);      try {        const msg = JSON.parse(e.data);        if (msg.type === 'chat') pushIncoming(msg);      } catch {}    };    return () => { if (ws.onmessage !== null) ws.onmessage = originalOnMessage; };  }, [wsRef, pushIncoming]);

  const sendMessage = useCallback((text) => {    const trimmed = text?.trim().slice(0, MAX_LENGTH);    if (!trimmed) return;    const tempId = `c${Date.now()}_${++counterRef.current}`;    const ts = new Date().toISOString();    setMessages((prev) => {      const next = [...prev, { id: tempId, user: user?.username ?? 'me', text: trimmed, ts, is_me: true, is_pending: true }];      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;    });    const tid = setTimeout(() => {      setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, is_pending: false, error: true } : m));      delete pendingRef.current[tempId];    }, CONFIRM_TIMEOUT);    pendingRef.current[tempId] = tid;    try { if (typeof sendChatFn === 'function') sendChatFn(trimmed); } catch (e) {      clearTimeout(pendingRef.current[tempId]); delete pendingRef.current[tempId];      setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, is_pending: false, error: true } : m));    }  }, [sendChatFn, user]);

  const clearMessages = useCallback(() => { setMessages([]); seenRef.current.clear(); }, []);
  return { messages, sendMessage, pushIncoming, clearMessages };
}
