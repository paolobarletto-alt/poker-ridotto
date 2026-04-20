/**
 * useTableChat.js — Hook per la chat di un tavolo poker.
 *
 * Utilizzo:
 *   // Nel componente che usa entrambi gli hook:
 *
 *   const chatCallbackRef = useRef(null);
 *   const onChatMessage   = useCallback((msg) => chatCallbackRef.current?.(msg), []);
 *
 *   const { sendChat, ... } = usePokerTable(tableId, { onChatMessage });
 *   const { messages, sendMessage } = useTableChat(sendChat, chatCallbackRef);
 *
 * L'hook registra la propria funzione pushIncoming in chatCallbackRef,
 * così usePokerTable può consegnarle i messaggi chat in arrivo
 * senza dipendenza circolare.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const MAX_MESSAGES = 100;
const MAX_LENGTH   = 200;   // coerente col backend

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {(message: string) => void} sendChatFn
 *   Funzione sendChat esposta da usePokerTable.
 *
 * @param {{ current: Function | null }} [callbackRef]
 *   Ref condivisa con il componente padre.
 *   L'hook ci scrive la propria pushIncoming così usePokerTable
 *   può chiamarla quando arriva { type: "chat", ... }.
 */
export function useTableChat(sendChatFn, callbackRef = null) {
  const { user } = useAuth();

  const [messages, setMessages] = useState([]);
  const counterRef   = useRef(0);
  const sentSetRef   = useRef(new Set()); // chiavi per dedup ottimistico

  // ── Aggiungi un messaggio alla lista ──────────────────────────────────────

  const _push = useCallback((from, message, ts, isMe) => {
    const id = ++counterRef.current;
    setMessages((prev) => {
      const next = [...prev, { id, from, message, ts: ts ? new Date(ts) : new Date(), isMe }];
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });
    return id;
  }, []);

  // ── Ricevi messaggio in arrivo dal server ─────────────────────────────────

  const pushIncoming = useCallback((msg) => {
    const isMe = msg.from === (user?.username ?? '');

    if (isMe) {
      // Rimuovi eventuale duplicato ottimistico (stessa stringa inviata di recente)
      const key = `${msg.message}`;
      if (sentSetRef.current.has(key)) {
        sentSetRef.current.delete(key);
        // Sostituisci il messaggio ottimistico con quello confermato dal server
        // (aggiorna ts con quello ufficiale del server)
        setMessages((prev) => {
          const idx = [...prev].reverse().findIndex(
            (m) => m.isMe && m.message === msg.message && m._optimistic
          );
          if (idx === -1) return prev; // nessun ottimistico trovato, aggiungi normalmente
          const realIdx = prev.length - 1 - idx;
          const updated = [...prev];
          updated[realIdx] = {
            ...updated[realIdx],
            ts: msg.ts ? new Date(msg.ts) : updated[realIdx].ts,
            _optimistic: false,
          };
          return updated;
        });
        return;
      }
    }

    _push(msg.from, msg.message, msg.ts, isMe);
  }, [user, _push]);

  // ── Registra pushIncoming nel ref condiviso ───────────────────────────────

  useEffect(() => {
    if (callbackRef) callbackRef.current = pushIncoming;
    return () => { if (callbackRef) callbackRef.current = null; };
  }, [callbackRef, pushIncoming]);

  // ── Invia un messaggio ────────────────────────────────────────────────────

  const sendMessage = useCallback((text) => {
    const trimmed = (text ?? '').trim().slice(0, MAX_LENGTH);
    if (!trimmed || !sendChatFn) return;

    // Aggiunta ottimistica: appare subito nella UI
    const key = trimmed;
    sentSetRef.current.add(key);
    const id = ++counterRef.current;
    setMessages((prev) => {
      const next = [
        ...prev,
        {
          id,
          from:        user?.username ?? 'Tu',
          message:     trimmed,
          ts:          new Date(),
          isMe:        true,
          _optimistic: true,
        },
      ];
      return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    });

    sendChatFn(trimmed);
  }, [sendChatFn, user]);

  // ── Svuota la chat ────────────────────────────────────────────────────────

  const clearMessages = useCallback(() => {
    setMessages([]);
    sentSetRef.current.clear();
  }, []);

  return {
    messages,      // [{ id, from, message, ts: Date, isMe }]
    sendMessage,   // (text) => void
    pushIncoming,  // esposto per chi preferisce chiamarlo direttamente
    clearMessages,
  };
}
