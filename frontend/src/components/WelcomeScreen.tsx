import React from 'react';
import { UploadZone } from './UploadZone';
import { DocumentInfo } from '../types';
import { FiapLogo } from './FiapLogo';
import { motion } from 'motion/react';

interface WelcomeScreenProps {
  onUpload: (doc: DocumentInfo) => void;
}

export function WelcomeScreen({ onUpload }: WelcomeScreenProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-bg-dark h-[100dvh]">
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-12 text-center select-none flex justify-center"
      >
        <FiapLogo className="w-64 h-auto" />
      </motion.div>
      
      <motion.p 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="text-text-secondary text-lg mb-8 font-light text-center"
      >
        Envie um documento para começar
      </motion.p>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-[480px]"
      >
        <UploadZone onUpload={onUpload} />
      </motion.div>
    </div>
  );
}
