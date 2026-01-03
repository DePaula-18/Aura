
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, UserState, Message, MoodEntry } from './types';
import { getAuraResponseStream, getAuraSpeech } from './geminiService';
import { 
  Heart, 
  MessageCircle, 
  BarChart3, 
  Wind, 
  Home, 
  Plus, 
  Smile, 
  Frown, 
  Meh, 
  SmilePlus, 
  CloudRain,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Download
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// --- Audio Utilities ---

function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const createWavBlob = (base64Data: string) => {
  const pcmData = decodeBase64(base64Data);
  const sampleRate = 24000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcmData.length;
  
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); 
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);
  
  new Uint8Array(buffer, 44).set(pcmData);
  return new Blob([buffer], { type: 'audio/wav' });
};

// --- Components ---

const Sidebar = ({ activeView, setView }: { activeView: View, setView: (v: View) => void }) => {
  const navItems = [
    { id: View.DASHBOARD, label: 'Início', icon: Home },
    { id: View.CHAT, label: 'Conversar', icon: MessageCircle },
    { id: View.MOOD, label: 'Humor', icon: BarChart3 },
    { id: View.EXERCISE, label: 'Relaxar', icon: Wind },
  ];

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around p-2 md:relative md:w-64 md:h-screen md:flex-col md:justify-start md:border-r md:p-4 z-50">
      <div className="hidden md:flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center">
          <Sparkles className="text-white w-5 h-5" />
        </div>
        <span className="font-brand font-bold text-xl text-indigo-600">Aura</span>
      </div>
      {navItems.map((item) => (
        <button
          key={item.id}
          onClick={() => setView(item.id)}
          className={`flex flex-col md:flex-row items-center gap-1 md:gap-3 p-2 md:p-3 rounded-xl transition-all ${
            activeView === item.id 
              ? 'text-indigo-600 bg-indigo-50 md:bg-indigo-50' 
              : 'text-slate-500 hover:text-indigo-400 hover:bg-slate-50'
          }`}
        >
          <item.icon className="w-6 h-6" />
          <span className="text-xs md:text-sm font-medium">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};

const Header = ({ title, isMuted, setIsMuted }: { title: string, isMuted: boolean, setIsMuted: (m: boolean) => void }) => (
  <header className="p-4 md:p-6 flex items-center justify-between sticky top-0 bg-slate-50/80 backdrop-blur-md z-40">
    <h1 className="text-2xl font-brand font-bold text-slate-800">{title}</h1>
    <div className="flex items-center gap-2 md:gap-3">
      <button 
        onClick={() => setIsMuted(!isMuted)}
        className={`w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:shadow-sm transition-all ${isMuted ? 'text-slate-400' : 'text-indigo-500'}`}
      >
        {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
      <button className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:shadow-sm transition-shadow">
        <Heart className="w-5 h-5 text-rose-400" />
      </button>
    </div>
  </header>
);

const BreathingExercise = () => {
  const [phase, setPhase] = useState<'Inale' | 'Segure' | 'Exale'>('Inale');
  const [counter, setCounter] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCounter((prev) => {
        if (prev <= 1) {
          if (phase === 'Inale') { setPhase('Segure'); return 4; }
          if (phase === 'Segure') { setPhase('Exale'); return 4; }
          setPhase('Inale'); return 4;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  return (
    <div className="flex flex-col items-center justify-center p-8 h-full min-h-[400px]">
      <div className="relative flex items-center justify-center">
        <div className={`w-48 h-48 md:w-64 md:h-64 rounded-full bg-indigo-100 flex items-center justify-center transition-all duration-[4000ms] ease-in-out ${
          phase === 'Inale' ? 'scale-125' : phase === 'Exale' ? 'scale-75' : 'scale-125'
        }`}>
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">{phase}</p>
            <p className="text-4xl font-brand font-bold text-indigo-400">{counter}</p>
          </div>
        </div>
        <div className="absolute w-64 h-64 md:w-80 md:h-80 border-2 border-indigo-200 rounded-full animate-blob"></div>
      </div>
      <p className="mt-12 text-slate-500 text-center max-w-xs">
        Foque na sua respiração. Deixe as preocupações passarem como nuvens.
      </p>
    </div>
  );
};

const MoodTracker = ({ history, onAdd }: { history: MoodEntry[], onAdd: (score: number) => void }) => {
  const moodIcons = [
    { score: 1, icon: CloudRain, label: 'Muito Triste', color: 'text-blue-500' },
    { score: 2, icon: Frown, label: 'Triste', color: 'text-indigo-400' },
    { score: 3, icon: Meh, label: 'Neutro', color: 'text-slate-400' },
    { score: 4, icon: Smile, label: 'Bem', color: 'text-emerald-400' },
    { score: 5, icon: SmilePlus, label: 'Excelente', color: 'text-yellow-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Como você está se sentindo agora?</h2>
        <div className="flex justify-between items-center max-w-md mx-auto">
          {moodIcons.map((m) => (
            <button
              key={m.score}
              onClick={() => onAdd(m.score)}
              className="group flex flex-col items-center gap-2"
            >
              <div className={`p-3 rounded-2xl bg-slate-50 group-hover:bg-indigo-50 transition-colors ${m.color}`}>
                <m.icon className="w-8 h-8" />
              </div>
              <span className="text-xs text-slate-500">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm h-64">
        <h2 className="text-lg font-semibold mb-4">Tendência de Humor</h2>
        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="date" hide />
              <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} hide />
              <Tooltip 
                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(value: number) => [moodIcons.find(m => m.score === value)?.label || value, 'Humor']}
              />
              <Line type="monotone" dataKey="score" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#6366f1' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-slate-400">
            Acompanhe seu humor por alguns dias para ver o gráfico.
          </div>
        )}
      </div>
    </div>
  );
};

const ChatView = ({ 
  messages, 
  onSendMessage, 
  isTyping, 
  streamingText,
  onReplay,
  onDownload
}: { 
  messages: Message[], 
  onSendMessage: (msg: string) => void, 
  isTyping: boolean, 
  streamingText: string,
  onReplay: (msg: Message) => void,
  onDownload: (msg: Message) => void
}) => {
  const [input, setInput] = useState('');
  const scrollRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendMessage(input);
    setInput('');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-160px)] md:h-[calc(100vh-120px)] bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth">
        {messages.length === 0 && (
          <div className="text-center py-12 px-6">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Sparkles className="text-indigo-400 w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-800">Olá! Eu sou a Aura.</h3>
            <p className="text-slate-500">Como você está hoje? Pode me contar qualquer coisa, estou aqui para ouvir e ajudar.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl relative group ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-br-none' 
                : 'bg-slate-100 text-slate-800 rounded-bl-none'
            }`}>
              <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{m.content}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] opacity-60">
                  {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {m.role === 'assistant' && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onReplay(m)}
                      title="Ouvir novamente"
                      className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => onDownload(m)}
                      title="Baixar áudio"
                      className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {streamingText && (
          <div className="flex justify-start">
             <div className="max-w-[85%] p-4 rounded-2xl bg-slate-100 text-slate-800 rounded-bl-none animate-pulse">
                <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">{streamingText}</p>
             </div>
          </div>
        )}
        {isTyping && !streamingText && (
          <div className="flex justify-start">
            <div className="bg-slate-100 p-4 rounded-2xl rounded-bl-none">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Diga o que está no seu coração..."
          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />
        <button 
          type="submit"
          className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 disabled:opacity-50"
          disabled={!input.trim() || isTyping}
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};

const Dashboard = ({ user, setView }: { user: UserState, setView: (v: View) => void }) => {
  const latestMood = user.moodHistory[user.moodHistory.length - 1];
  
  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl shadow-indigo-200 overflow-hidden relative">
        <div className="relative z-10">
          <h2 className="text-2xl font-brand font-bold mb-2">Bem-vinda de volta!</h2>
          <p className="text-indigo-100 mb-6">"Cada dia é uma nova oportunidade de florescer."</p>
          <button 
            onClick={() => setView(View.CHAT)}
            className="bg-white text-indigo-600 px-6 py-2 rounded-full font-semibold hover:bg-indigo-50 transition-colors flex items-center gap-2"
          >
            Conversar com Aura <Sparkles className="w-4 h-4" />
          </button>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-indigo-500 rounded-full blur-3xl opacity-50"></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Último Humor</h3>
            <p className="text-slate-500 text-sm mb-4">Veja como você estava se sentindo</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500">
              {latestMood ? <Smile className="w-8 h-8" /> : <Plus className="w-8 h-8" />}
            </div>
            <div>
              <p className="font-bold text-slate-800">{latestMood ? `Humor: ${latestMood.score}/5` : 'Ainda não registrado'}</p>
              <button onClick={() => setView(View.MOOD)} className="text-indigo-600 text-sm font-medium">Ver histórico</button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Dose de Calma</h3>
            <p className="text-slate-500 text-sm mb-4">Exercício de respiração guiado</p>
          </div>
          <button 
            onClick={() => setView(View.EXERCISE)}
            className="w-full bg-slate-900 text-white py-3 rounded-2xl font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <Wind className="w-5 h-5" /> Começar Agora
          </button>
        </div>
      </div>

      <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl">
        <h3 className="text-rose-800 font-bold mb-2 flex items-center gap-2">
          <Heart className="w-5 h-5 fill-rose-500" /> Dica da Aura
        </h3>
        <p className="text-rose-700 text-sm italic">
          "Tire 5 minutos hoje para listar três coisas pelas quais você é grato. A gratidão muda nossa perspectiva sobre o mundo."
        </p>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [view, setView] = useState<View>(View.DASHBOARD);
  const [isTyping, setIsTyping] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [userState, setUserState] = useState<UserState>(() => {
    const saved = localStorage.getItem('aura_user_state');
    return saved ? JSON.parse(saved) : {
      name: 'Amiga',
      moodHistory: [],
      chatHistory: []
    };
  });

  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);

  useEffect(() => {
    localStorage.setItem('aura_user_state', JSON.stringify(userState));
  }, [userState]);

  const playAudioBuffer = async (base64Audio: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    const ctx = audioContextRef.current;
    
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const audioBytes = decodeBase64(base64Audio);
    const audioBuffer = await decodeAudioData(audioBytes, ctx, 24000, 1);
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    const startTime = Math.max(nextStartTimeRef.current, ctx.currentTime);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
  };

  const handleSendMessage = useCallback(async (content: string) => {
    const userMsg: Message = { role: 'user', content, timestamp: Date.now() };
    
    setUserState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, userMsg]
    }));
    
    setIsTyping(true);
    setStreamingText("");
    nextStartTimeRef.current = 0; 

    try {
      const responseStream = await getAuraResponseStream(content, userState.chatHistory);
      let fullResponseText = "";
      let currentSentence = "";

      for await (const chunk of responseStream) {
        const textChunk = chunk.text;
        fullResponseText += textChunk;
        currentSentence += textChunk;
        setStreamingText(fullResponseText);

        if (/[.!?](\s|\n|$)/.test(currentSentence) && currentSentence.length > 15) {
          if (!isMuted) {
            const sentenceAudio = await getAuraSpeech(currentSentence.trim());
            if (sentenceAudio) playAudioBuffer(sentenceAudio);
          }
          currentSentence = "";
        }
      }

      if (currentSentence.trim() && !isMuted) {
        const sentenceAudio = await getAuraSpeech(currentSentence.trim());
        if (sentenceAudio) playAudioBuffer(sentenceAudio);
      }

      // Após o término do streaming, gera o áudio completo para replay/download
      const fullAudio = await getAuraSpeech(fullResponseText);

      const auraMsg: Message = { 
        role: 'assistant', 
        content: fullResponseText, 
        timestamp: Date.now(),
        audioBase64: fullAudio || undefined
      };

      setUserState(prev => ({
        ...prev,
        chatHistory: [...prev.chatHistory, auraMsg]
      }));
      setStreamingText("");
      setIsTyping(false);

    } catch (error) {
      console.error("Error handling message:", error);
      setIsTyping(false);
      setStreamingText("");
    }
  }, [userState.chatHistory, isMuted]);

  const handleReplay = async (msg: Message) => {
    if (!msg.audioBase64) {
      // Se não houver áudio salvo, tenta gerar um agora
      const audio = await getAuraSpeech(msg.content);
      if (audio) {
        nextStartTimeRef.current = 0;
        playAudioBuffer(audio);
        // Atualiza a mensagem com o áudio gerado
        setUserState(prev => ({
          ...prev,
          chatHistory: prev.chatHistory.map(m => m.timestamp === msg.timestamp ? { ...m, audioBase64: audio } : m)
        }));
      }
      return;
    }
    nextStartTimeRef.current = 0;
    playAudioBuffer(msg.audioBase64);
  };

  const handleDownload = async (msg: Message) => {
    let audioBase64 = msg.audioBase64;
    
    if (!audioBase64) {
      audioBase64 = await getAuraSpeech(msg.content) || undefined;
      if (audioBase64) {
        setUserState(prev => ({
          ...prev,
          chatHistory: prev.chatHistory.map(m => m.timestamp === msg.timestamp ? { ...m, audioBase64: audioBase64 } : m)
        }));
      }
    }

    if (audioBase64) {
      const blob = createWavBlob(audioBase64);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conselho_aura_${new Date(msg.timestamp).getTime()}.mp3`; // Salva como .mp3 como solicitado
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleAddMood = (score: number) => {
    const newEntry: MoodEntry = {
      date: new Date().toLocaleDateString(),
      score,
      timestamp: Date.now()
    } as any;
    
    setUserState(prev => ({
      ...prev,
      moodHistory: [...prev.moodHistory, newEntry]
    }));
    
    setView(View.CHAT);
    const feelings = ["muito triste", "triste", "neutro", "bem", "excelente"];
    handleSendMessage(`Hoje estou me sentindo ${feelings[score - 1]}.`);
  };

  const getViewTitle = () => {
    switch (view) {
      case View.DASHBOARD: return "Sua Jornada";
      case View.CHAT: return "Conversar com Aura";
      case View.MOOD: return "Seu Humor";
      case View.EXERCISE: return "Respiração Consciente";
    }
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar activeView={view} setView={setView} />
      
      <main className="flex-1 flex flex-col">
        <Header title={getViewTitle()} isMuted={isMuted} setIsMuted={setIsMuted} />
        
        <div className="p-4 md:p-8 max-w-4xl mx-auto w-full flex-1">
          {view === View.DASHBOARD && <Dashboard user={userState} setView={setView} />}
          {view === View.MOOD && <MoodTracker history={userState.moodHistory} onAdd={handleAddMood} />}
          {view === View.EXERCISE && <BreathingExercise />}
          {view === View.CHAT && (
            <ChatView 
              messages={userState.chatHistory} 
              onSendMessage={handleSendMessage} 
              isTyping={isTyping} 
              streamingText={streamingText}
              onReplay={handleReplay}
              onDownload={handleDownload}
            />
          )}
        </div>
      </main>
    </div>
  );
}
