'use client';
import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

type Msg = { role: 'user' | 'assistant'; content: string; payment_url?: string };

const WELCOME: Msg = {
  role: 'assistant',
  content: '¡Hola! 👋 Soy el asistente de QRPass. ¿Qué tipo de organización querés gestionar?',
};

export function AgenteVentas() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(() => {
    try { return crypto.randomUUID(); } catch {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
  });
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [humanTakeover, setHumanTakeover] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  // Show lead form after 3 user messages if no email yet
  useEffect(() => {
    const userCount = msgs.filter(m => m.role === 'user').length;
    if (userCount >= 3 && !email && !showLeadForm) setShowLeadForm(true);
  }, [msgs, email, showLeadForm]);

  // Poll for admin replies when human takeover is active
  useEffect(() => {
    if (!humanTakeover) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(EDGE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ poll: true, session_id: sessionId }),
        });
        const data = await res.json();
        if (data.reply) {
          setMsgs(prev => [...prev, { role: 'assistant', content: data.reply }]);
        }
        if (!data.human_takeover) setHumanTakeover(false);
      } catch { /* ignore */ }
    }, 4000);
    return () => clearInterval(interval);
  }, [humanTakeover, sessionId]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    const newMsgs: Msg[] = [...msgs, { role: 'user', content }];
    setMsgs(newMsgs);
    setLoading(true);
    try {
      const { reply } = await api.chat.send({
        messages: newMsgs.map(m => ({ role: m.role, content: m.content })),
      });
      setMsgs(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: 'Hubo un error. Intentá de nuevo.' }]);
    }
    setLoading(false);
  };

  const handleLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowLeadForm(false);
    send(`Me llamo ${nombre} y mi email es ${email}`);
  };

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(o => !o)}
        style={s.fab}
        aria-label="Chat con asistente"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* Chat panel */}
      {open && (
        <div style={s.panel}>
          {/* Header */}
          <div style={s.header}>
            <div style={s.headerDot} />
            <div>
              <p style={s.headerTitle}>Asistente QRPass</p>
              <p style={s.headerSub}>Siempre activo · responde al instante</p>
            </div>
          </div>

          {/* Messages */}
          <div style={s.msgs}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 10, flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={m.role === 'user' ? s.bubbleUser : s.bubbleBot}>
                  {m.content}
                </div>
                {m.payment_url && (
                  <a
                    href={m.payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={s.payBtn}
                  >
                    💳 Pagar con Mercado Pago
                  </a>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 10 }}>
                <div style={{ ...s.bubbleBot, color: '#64748b' }}>...</div>
              </div>
            )}

            {/* Lead capture form */}
            {showLeadForm && !email && (
              <div style={s.leadBox}>
                <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 10px' }}>
                  ¿Querés que te contactemos? Dejanos tus datos:
                </p>
                <form onSubmit={handleLeadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input
                    style={s.leadInput}
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    required
                  />
                  <input
                    style={s.leadInput}
                    type="email"
                    placeholder="Tu email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                  <button style={s.leadBtn} type="submit">Enviar →</button>
                </form>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {msgs.length === 1 && (
            <div style={s.quickReplies}>
              {['¿Qué es QRPass?', 'Tengo un gimnasio', 'Tengo un barrio cerrado', '¿Cuánto cuesta?'].map(q => (
                <button key={q} style={s.quickBtn} onClick={() => send(q)}>{q}</button>
              ))}
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={e => { e.preventDefault(); send(); }}
            style={s.inputRow}
          >
            <input
              ref={inputRef}
              style={s.textInput}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Escribí tu consulta..."
              disabled={loading}
            />
            <button style={s.sendBtn} type="submit" disabled={loading || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  fab: {
    position: 'fixed', bottom: 28, right: 28, zIndex: 1000,
    width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
    border: 'none', fontSize: 24, cursor: 'pointer',
    boxShadow: '0 4px 20px rgba(59,130,246,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.2s',
  },
  panel: {
    position: 'fixed', bottom: 96, right: 28, zIndex: 999,
    width: 360, maxWidth: 'calc(100vw - 32px)',
    background: '#1a1a2e', borderRadius: 20,
    border: '1px solid #1e3a5f',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    display: 'flex', flexDirection: 'column',
    maxHeight: 520, overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
    borderBottom: '1px solid #1e293b', background: '#16213e',
    borderRadius: '20px 20px 0 0',
  },
  headerDot: { width: 10, height: 10, borderRadius: '50%', background: '#22c55e', flexShrink: 0 },
  headerTitle: { fontSize: 15, fontWeight: 700, color: '#f1f5f9', margin: 0 },
  headerSub: { fontSize: 11, color: '#64748b', margin: '2px 0 0' },
  msgs: { flex: 1, overflowY: 'auto', padding: '16px 16px 8px', display: 'flex', flexDirection: 'column' },
  bubbleUser: {
    maxWidth: '80%', background: '#1d4ed8', color: '#fff',
    borderRadius: '16px 16px 4px 16px', padding: '10px 14px',
    fontSize: 14, lineHeight: 1.5,
  },
  bubbleBot: {
    maxWidth: '80%', background: '#0f172a', color: '#e2e8f0',
    border: '1px solid #1e293b', borderRadius: '16px 16px 16px 4px',
    padding: '10px 14px', fontSize: 14, lineHeight: 1.5,
  },
  leadBox: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 12,
    padding: 14, margin: '4px 0 8px',
  },
  leadInput: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 8,
    padding: '8px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none', width: '100%',
    boxSizing: 'border-box',
  },
  leadBtn: {
    background: '#3b82f6', color: '#fff', border: 'none',
    borderRadius: 8, padding: '8px 14px', fontWeight: 700,
    fontSize: 13, cursor: 'pointer',
  },
  quickReplies: {
    display: 'flex', flexWrap: 'wrap', gap: 6, padding: '0 12px 10px',
  },
  quickBtn: {
    background: '#0f172a', border: '1px solid #334155', borderRadius: 20,
    color: '#94a3b8', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
  },
  inputRow: {
    display: 'flex', gap: 8, padding: '12px 14px',
    borderTop: '1px solid #1e293b', background: '#16213e',
    borderRadius: '0 0 20px 20px',
  },
  textInput: {
    flex: 1, background: '#0f172a', border: '1px solid #334155',
    borderRadius: 12, padding: '10px 14px', color: '#f1f5f9',
    fontSize: 14, outline: 'none',
  },
  sendBtn: {
    background: '#3b82f6', border: 'none', borderRadius: 12,
    width: 40, color: '#fff', fontSize: 16, cursor: 'pointer',
    opacity: 1, flexShrink: 0,
  },
  payBtn: {
    display: 'inline-block', marginTop: 8,
    background: 'linear-gradient(135deg, #009ee3, #00b9f2)',
    color: '#fff', textDecoration: 'none',
    borderRadius: 12, padding: '10px 18px',
    fontSize: 14, fontWeight: 700,
    boxShadow: '0 4px 14px rgba(0,158,227,0.4)',
  },
};
