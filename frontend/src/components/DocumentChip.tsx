import React from 'react';
import { MdDescription, MdClose } from 'react-icons/md';
import { DocumentInfo } from '../types';

interface DocumentChipProps {
  doc: DocumentInfo;
  onRemove: () => void;
}

export function DocumentChip({ doc, onRemove }: DocumentChipProps) {
  return (
    <div className="bg-bg-lighter flex items-center gap-2 px-2 py-1 flex-shrink-0">
      {/* @ts-ignore */}
      <MdDescription className="text-highlight shrink-0" size={12} />
      <span className="text-[10px] text-text-secondary font-bold uppercase tracking-tight truncate max-w-[150px]">{doc.filename}</span>
      <button 
        onClick={onRemove}
        className="text-text-muted hover:text-white transition-colors shrink-0 flex items-center justify-center p-0.5"
        title="Remover documento"
      >
        {/* @ts-ignore */}
        <MdClose size={10} strokeWidth={3} />
      </button>
    </div>
  );
}
