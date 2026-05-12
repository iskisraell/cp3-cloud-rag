export interface DocumentInfo {
  id: number;
  filename: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { filename: string; distance: number }[];
  isStreaming?: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface MatchScore {
  filename: string;
  content: string;
  distance: number;
}
