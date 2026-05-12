import React, { useCallback, useRef, useState } from 'react';
import { MdCloudUpload } from 'react-icons/md';
import { cn } from '../lib/utils';
import { api } from '../api';
import { DocumentInfo } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface UploadZoneProps {
  onUpload: (doc: DocumentInfo) => void;
  className?: string;
  compact?: boolean;
}

export function UploadZone({ onUpload, className, compact }: UploadZoneProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setIsUploading(true);
    try {
      const doc = await api.upload(file);
      onUpload(doc);
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsHovered(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={cn(
        "relative flex flex-col items-center justify-center cursor-pointer transition-colors border-2 border-dashed",
        isHovered ? "border-highlight bg-highlight/10" : "border-text-muted bg-bg-dark hover:bg-bg-lighter",
        compact ? "p-4 h-24" : "p-8 h-48 w-full max-w-[480px]",
        className
      )}
      onDragOver={(e) => { e.preventDefault(); setIsHovered(true); }}
      onDragLeave={() => setIsHovered(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={handleChange}
        accept=".pdf,.txt"
      />
      
      <AnimatePresence mode="wait">
        {isUploading ? (
          <motion.div 
            key="uploading"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center space-y-3"
          >
            <div className="w-8 h-8 bg-highlight animate-spin"></div>
            <p className="text-text-muted text-sm font-medium">Enviando...</p>
          </motion.div>
        ) : (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center"
          >
            {/* @ts-ignore */}
            <MdCloudUpload className={cn("text-text-muted mb-3 transition-colors", compact ? "text-2xl" : "text-4xl", isHovered && "text-highlight")} />
            <p className={cn("text-text-primary text-center font-bold tracking-tight", compact ? "text-sm" : "text-base")}>
              {isHovered ? 'Solte o arquivo...' : 'Arraste um PDF ou TXT aqui'}
            </p>
            {!compact && (
              <p className="text-text-muted text-sm mt-2 font-light">ou clique para selecionar</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
