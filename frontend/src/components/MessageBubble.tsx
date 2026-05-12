import React from 'react';
import { Message } from '../types';
import { useStreamingText } from '../hooks/useStreamingText';
import { cn } from '../lib/utils';
import { motion } from 'motion/react';
import { MdKeyboardArrowDown } from 'react-icons/md';

interface MessageBubbleProps {
  key?: React.Key;
  message: Message;
  onStreamComplete?: () => void;
}

export function MessageBubble({ message, onStreamComplete }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const displayedText = useStreamingText(
    message.content, 
    !!message.isStreaming, 
    onStreamComplete
  );
  const uniqueSources = message.sources?.reduce((items, source) => {
    const existing = items.find(item => item.filename === source.filename);
    if (!existing || source.distance < existing.distance) {
      return [...items.filter(item => item.filename !== source.filename), source]
        .sort((a, b) => a.distance - b.distance);
    }
    return items;
  }, [] as NonNullable<Message['sources']>) || [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "flex flex-col mb-8",
        isUser ? "items-end" : "items-start"
      )}
    >
      {isUser ? (
        <>
          <div className="bg-bg-lighter p-4 text-text-primary text-sm max-w-[85%] leading-relaxed border-none focus:outline-none shadow-none rounded-none">
            {message.content}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start w-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-highlight text-[10px] font-black border border-highlight px-1">AI</span>
            <span className="text-[10px] text-text-muted uppercase font-medium tracking-widest">FIAP ASSISTANT</span>
          </div>
          <div className="text-text-body text-sm max-w-[95%] leading-relaxed w-full">
            <div className="whitespace-pre-wrap inline break-words">
              {displayedText}
              {message.isStreaming && (
                <span className="inline-block w-2 h-4 bg-highlight ml-1 align-middle opacity-80 animate-pulse" />
              )}
            </div>

            {/* Sources */}
            {!message.isStreaming && uniqueSources.length > 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="mt-4 pt-4 border-t border-bg-lighter w-full"
              >
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[10px] uppercase tracking-widest text-text-muted hover:text-text-secondary">
                    <span>Fontes consultadas ({uniqueSources.length})</span>
                    {/* @ts-ignore */}
                    <MdKeyboardArrowDown className="transition-transform group-open:rotate-180" size={16} />
                  </summary>
                  <p className="mt-3 text-[10px] leading-relaxed text-text-muted">
                    Similaridade indica a distancia vetorial entre a pergunta e o trecho recuperado:
                    quanto menor o numero, mais proximo o trecho esta da pergunta.
                  </p>
                  <div className="mt-3 space-y-2">
                    {uniqueSources.map((src, idx) => (
                      <div key={`${src.filename}-${idx}`} className="border-l border-[#3D3D3D] pl-3">
                        <p className="text-[10px] text-text-secondary">{src.filename}</p>
                        <p className="text-[10px] text-text-muted">
                          Similaridade: {src.distance.toFixed(4)}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
