
export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audioBase64?: string; // Armazena o áudio gerado para replay e download
}

export interface MoodEntry {
  date: string;
  score: number; // 1-5
  note?: string;
}

export interface UserState {
  name: string;
  moodHistory: MoodEntry[];
  chatHistory: Message[];
}

export enum View {
  DASHBOARD = 'DASHBOARD',
  CHAT = 'CHAT',
  MOOD = 'MOOD',
  EXERCISE = 'EXERCISE'
}
