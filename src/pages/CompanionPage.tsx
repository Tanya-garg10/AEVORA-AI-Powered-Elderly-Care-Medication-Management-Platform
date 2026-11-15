import React, { useState, useRef, useEffect } from 'react';
import { Send, Mic, MicOff, ShieldAlert, MessageSquareHeart, Volume2, VolumeX, RotateCcw, Globe } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useToast } from '../components/Toast';
import { apiFetch } from '../lib/api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED_PROMPTS = [
  'What medicines do I have today?',
  'When is my next appointment?',
  'Summarize my care routine.',
  'Show my missed medication records.',
  'Guide me through confirming my morning medicine.',
];

const LANGUAGES: Array<{ label: string; speechCode: string }> = [
  { label: 'English', speechCode: 'en-US' },
  { label: 'Spanish', speechCode: 'es-ES' },
  { label: 'Hindi', speechCode: 'hi-IN' },
  { label: 'Mandarin', speechCode: 'zh-CN' },
  { label: 'French', speechCode: 'fr-FR' },
];

const WELCOME_MESSAGE: ChatMessage = {
  role: 'assistant',
  content:
    'Hello! I am AEVORA COMPANION. I can help explain today’s medication schedule, upcoming doctor appointments, and care notes in clear, simple language. How can I help today?',
};

export function CompanionPage() {
  const { showToast } = useToast();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [language, setLanguage] = useState('English');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [listening, setListening] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ messages: Array<{ role: 'user' | 'assistant'; content: string; language?: string }> }>('/api/companion/history')
      .then((res) => {
        if (res.messages && res.messages.length > 0) {
          setMessages([WELCOME_MESSAGE, ...res.messages.map((m) => ({ role: m.role, content: m.content }))]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setError('');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await apiFetch<{ reply: string }>('/api/companion/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: nextMessages, language }),
      });
      setMessages([...nextMessages, { role: 'assistant', content: res.reply }]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetHistory = async () => {
    try {
      await apiFetch('/api/companion/history', { method: 'DELETE' });
      setMessages([WELCOME_MESSAGE]);
      showToast('Conversation cleared');
    } catch (err: any) {
      showToast('Could not clear history', { description: err.message, variant: 'error' });
    }
  };

  const toggleSpeak = (idx: number, content: string) => {
    if (!('speechSynthesis' in window)) {
      setError('Text-to-speech playback is not supported in this browser.');
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingIdx === idx) {
      setSpeakingIdx(null);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(content);
    const langCfg = LANGUAGES.find((l) => l.label === language);
    utterance.lang = langCfg?.speechCode || 'en-US';
    utterance.rate = 0.94;
    utterance.onend = () => setSpeakingIdx(null);
    utterance.onerror = () => setSpeakingIdx(null);
    setSpeakingIdx(idx);
    window.speechSynthesis.speak(utterance);
  };

  const toggleVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Voice recognition is not supported in this browser. Please type your question below.');
      return;
    }
    if (listening) return;

    const recognition = new SpeechRecognition();
    const langCfg = LANGUAGES.find((l) => l.label === language);
    recognition.lang = langCfg?.speechCode || 'en-US';
    recognition.interimResults = false;
    setListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
      setListening(false);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognition.start();
  };

  return (
    <DashboardLayout title="AEVORA Companion" subtitle="Multilingual AI care routine explanations with voice input and read-aloud support">
      <div className="max-w-4xl mx-auto space-y-5">
        {/* Safety Notice & Language Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#D9F0E8]/45 border border-[#167C80]/25 rounded-2xl p-4 text-xs text-[#142B3B]">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[#167C80] shrink-0 mt-0.5" />
            <div>
              <strong>AI-Generated Care Guidance:</strong> Explains schedules and terminology calmly. Never diagnoses, prescribes, or adjusts dosages. For urgent symptoms, call emergency services immediately.
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Globe className="w-4 h-4 text-[#167C80]" />
            <select
              aria-label="Companion Language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-[#142B3B]/15 bg-white text-xs font-semibold"
            >
              {LANGUAGES.map((l) => (
                <option key={l.label} value={l.label}>{l.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleResetHistory}
              title="Clear conversation"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#142B3B]/15 bg-white text-xs font-semibold text-[#3E515E] hover:text-[#B42318]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          </div>
        </div>

        {/* Suggested Prompts */}
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => sendMessage(p)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white border border-[#142B3B]/15 text-xs font-semibold text-[#142B3B] hover:border-[#167C80] hover:bg-[#D9F0E8]/25 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Conversation Container */}
        <div className="bg-white border border-[#142B3B]/10 rounded-2xl flex flex-col h-[520px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-5 py-3.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-[#142B3B] text-white'
                      : 'bg-[#F8F7F2] border border-[#142B3B]/10 text-[#142B3B]'
                  }`}
                >
                  {m.role === 'assistant' && (
                    <div className="flex items-center justify-between gap-4 mb-1.5">
                      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[#167C80]">
                        <MessageSquareHeart className="w-3.5 h-3.5" /> AEVORA Companion
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleSpeak(idx, m.content)}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3E515E] hover:text-[#167C80]"
                      >
                        {speakingIdx === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                        {speakingIdx === idx ? 'Stop' : 'Read Aloud'}
                      </button>
                    </div>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#F8F7F2] border border-[#142B3B]/10 rounded-2xl px-5 py-3 text-sm text-[#74818B]">
                  Reviewing your care schedule...
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && (
            <div className="mx-6 mb-2 p-3 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-xs text-[#B42318]">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-4 border-t border-[#142B3B]/10 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleVoiceInput}
              aria-label="Voice input"
              className={`p-3 rounded-xl border transition-colors ${
                listening ? 'bg-[#B42318] text-white border-[#B42318]' : 'border-[#142B3B]/15 text-[#142B3B] hover:border-[#167C80]'
              }`}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask in ${language} about today’s medicines, appointments, or care terms...`}
              className="flex-1 px-4 py-3 rounded-xl border border-[#142B3B]/15 bg-[#F8F7F2]/60 focus:bg-white text-sm"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-5 py-3 rounded-xl bg-[#167C80] text-white text-sm font-semibold hover:bg-[#126568] disabled:opacity-50 inline-flex items-center gap-2"
            >
              <Send className="w-4 h-4" /> Send
            </button>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}
