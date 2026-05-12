import { DocumentInfo, MatchScore, ChatMessage } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
  checkReady: async (): Promise<{ models_loaded: boolean }> => {
    try {
      const res = await fetch(`${API_URL}/api/ready`);
      if (!res.ok) return { models_loaded: false };
      return res.json();
    } catch {
      return { models_loaded: false };
    }
  },

  upload: async (file: File): Promise<DocumentInfo> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },

  getDocuments: async (): Promise<{ documents: DocumentInfo[] }> => {
    const res = await fetch(`${API_URL}/documents`);
    if (!res.ok) throw new Error('Failed to fetch documents');
    return res.json();
  },

  ask: async (question: string, docId: number): Promise<{ matches: MatchScore[] }> => {
    const res = await fetch(`${API_URL}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, doc_id: docId })
    });
    if (!res.ok) throw new Error('Ask failed');
    return res.json();
  },

  askAll: async (question: string): Promise<{ matches: MatchScore[] }> => {
    const res = await fetch(`${API_URL}/ask_all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question })
    });
    if (!res.ok) throw new Error('Ask all failed');
    return res.json();
  },

  chat: async (
    question: string,
    docId?: number,
    history?: ChatMessage[]
  ): Promise<{ answer: string, sources: { filename: string, distance: number }[] }> => {
    const res = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, doc_id: docId, history: history || [] })
    });
    if (!res.ok) throw new Error('Chat failed');
    return res.json();
  }
};
