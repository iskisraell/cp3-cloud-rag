import React, { useState, useRef, useEffect } from 'react';
import { MdSend, MdAttachFile, MdDescription, MdClose } from 'react-icons/md';
import { DocumentInfo, Message, ChatMessage } from '../types';
import { api } from '../api';
import { MessageBubble } from './MessageBubble';
import { DocumentChip } from './DocumentChip';
import { FiapLogo } from './FiapLogo';
import { motion, AnimatePresence } from 'motion/react';

interface ChatViewProps {
  key?: React.Key;
  doc: DocumentInfo;
  onChangeDoc: (doc: DocumentInfo) => void;
  onClear: () => void;
}

export function ChatView({ doc, onChangeDoc, onClear }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAwaitingInference, setIsAwaitingInference] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  const handleSend = async () => {
    if (!inputValue.trim() || isStreaming || isUploading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = inputValue;
    setInputValue('');
    setIsStreaming(true);
    setIsAwaitingInference(true);

    try {
      const history: ChatMessage[] = messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
        .slice(-6);

      const response = await api.chat(currentInput, doc.id, history);
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        sources: response.sources,
        isStreaming: true
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (e) {
      console.error(e);
      setIsStreaming(false);
    } finally {
      setIsAwaitingInference(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStreamComplete = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isStreaming: false } : m));
    setIsStreaming(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      try {
        const newDoc = await api.upload(file);
        onChangeDoc(newDoc);
      } catch (err) {
        console.error("Failed to upload new doc", err);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-bg-dark">
      {/* Header */}
      <motion.header 
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="py-4 md:py-5 min-h-[80px] bg-bg-lighter flex items-center justify-between px-6 md:px-8 border-b border-[#3D3D3D] shrink-0 z-20"
      >
        <div className="flex items-center">
          <FiapLogo className="w-24 h-auto" />
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex bg-bg-dark items-center gap-2 px-3 py-1.5 border border-[#3D3D3D]">
            {/* @ts-ignore */}
            <MdDescription className="text-text-secondary" size={16} />
            <span className="text-xs text-text-secondary font-medium truncate max-w-[150px]">{doc.filename}</span>
            <button 
              onClick={onClear} 
              className="text-text-muted hover:text-highlight transition-colors shrink-0 ml-2" 
              title="Remover documento"
            >
              {/* @ts-ignore */}
              <MdClose size={14} />
            </button>
          </div>
          <button 
            onClick={onClear} 
            className="border border-highlight text-highlight text-[10px] md:text-xs px-3 md:px-4 py-2 uppercase font-bold tracking-widest hover:bg-highlight hover:text-white transition-colors"
          >
            Novo documento
          </button>
        </div>
      </motion.header>

      {/* Messages Area */}
      <main className="flex-1 overflow-hidden flex flex-col items-center relative z-0">
        <div className="w-full max-w-[768px] h-full flex flex-col py-8 px-6 overflow-y-auto">
          <AnimatePresence mode="popLayout">
            {messages.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 0.5, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                transition={{ duration: 0.5 }}
                className="flex-1 flex flex-col items-center justify-center pb-12 text-center select-none"
              >
                 {/* @ts-ignore */}
                 <MdDescription className="text-4xl text-text-muted mb-4" />
                 <p className="text-text-muted text-sm max-w-sm">
                   Documento "{doc.filename}" carregado. Faça uma pergunta para analisá-lo.
                 </p>
              </motion.div>
            ) : (
              messages.map(msg => (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  onStreamComplete={msg.isStreaming ? () => handleStreamComplete(msg.id) : undefined}
                />
              ))
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} className="h-4 shrink-0" />
        </div>
      </main>

      {/* Bottom Input Area */}
      <motion.footer 
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="w-full bg-bg-dark border-t border-bg-lighter p-6 shrink-0 z-10 relative"
      >
        <div className="max-w-[768px] mx-auto w-full">
          
          <div className="mb-3 flex items-center min-h-8">
            <AnimatePresence>
               <motion.div
                 initial={{ opacity: 0, x: -10 }}
                 animate={{ opacity: 1, x: 0 }}
                 exit={{ opacity: 0, x: -10 }}
                 transition={{ duration: 0.3 }}
               >
                 <DocumentChip doc={doc} onRemove={onClear} />
               </motion.div>
               {isUploading && (
                 <motion.span 
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="ml-3 text-[10px] text-text-muted uppercase font-bold tracking-widest animate-pulse"
                 >
                   Enviando novo documento...
                 </motion.span>
               )}
            </AnimatePresence>
          </div>

          <div className="bg-bg-lighter flex items-center p-1 flex-1 border-transparent border focus-within:border-highlight transition-colors relative overflow-hidden group">
            <motion.div 
              className="absolute inset-0 bg-highlight/5 pointer-events-none opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" 
            />
            <button 
              className="p-3 text-text-secondary hover:text-white transition-colors shrink-0 disabled:opacity-50 relative z-10"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming || isUploading}
              title="Anexar documento"
            >
              {/* @ts-ignore */}
              <MdAttachFile size={20} />
            </button>
            <input 
              type="file" 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
              accept=".pdf,.txt"
            />
            
            <input 
              type="text" 
              className="flex-1 bg-transparent border-none outline-none text-text-primary text-sm px-2 placeholder-text-muted relative z-10"
              placeholder={isStreaming ? "Aguarde a resposta..." : "Faça uma pergunta sobre o documento..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming || isUploading}
            />
            
            <button 
              className={`bg-highlight text-white p-3 hover:opacity-90 active:scale-95 transition-all shrink-0 disabled:opacity-50 relative z-10 ${isAwaitingInference ? 'animate-pulse disabled:opacity-100' : ''}`}
              onClick={handleSend}
              disabled={!inputValue.trim() || isStreaming || isUploading}
            >
              {isStreaming ? (
                <FiapLogo className={`w-5 h-5 text-white opacity-80 mx-0.5 ${isAwaitingInference ? '' : 'animate-spin'}`} />
              ) : (
                /* @ts-ignore */
                <MdSend size={20} />
              )}
            </button>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
