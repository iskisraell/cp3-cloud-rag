import { useState, useEffect } from 'react';
import { FiapLogo } from './FiapLogo';
import { motion, AnimatePresence } from 'motion/react';

const LOADING_STEPS = [
  'Inicializando modelos de IA...',
  'Carregando modelo de embeddings...',
  'Preparando modelo de linguagem...',
  'Aquecendo inferencia...',
  'Quase pronto...',
];

export function ModelLoadingScreen() {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStepIndex(prev => (prev < LOADING_STEPS.length - 1 ? prev + 1 : prev));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-bg-dark h-[100dvh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mb-10 flex justify-center"
      >
        <FiapLogo className="w-48 h-auto opacity-90" />
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-col items-center"
      >
        <div className="w-48 h-[2px] bg-bg-lighter mb-8 overflow-hidden">
          <motion.div
            className="h-full bg-highlight"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 15, ease: 'linear' }}
          />
        </div>

        <div className="h-6 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.p
              key={stepIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4 }}
              className="text-text-muted text-sm font-light tracking-wide"
            >
              {LOADING_STEPS[stepIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
