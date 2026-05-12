import { useState, useEffect, useCallback } from 'react';
import { WelcomeScreen } from './components/WelcomeScreen';
import { ChatView } from './components/ChatView';
import { ModelLoadingScreen } from './components/ModelLoadingScreen';
import { DocumentInfo } from './types';
import { api } from './api';
import { AnimatePresence, motion } from 'motion/react';

type AppState = 'loading' | 'ready';

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [activeDoc, setActiveDoc] = useState<DocumentInfo | null>(null);

  const checkReady = useCallback(async () => {
    const result = await api.checkReady();
    if (result.models_loaded) {
      setAppState('ready');
    }
  }, []);

  useEffect(() => {
    if (appState === 'ready') {
      return;
    }

    checkReady();
    const interval = setInterval(checkReady, 3000);
    return () => clearInterval(interval);
  }, [appState, checkReady]);

  return (
    <div className="min-h-screen bg-bg-dark text-text-primary font-main flex flex-col overflow-hidden relative">
      <AnimatePresence mode="wait">
        {appState === 'loading' ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="flex-1 w-full h-full absolute inset-0"
          >
            <ModelLoadingScreen />
          </motion.div>
        ) : !activeDoc ? (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)", scale: 0.95 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 w-full h-full absolute inset-0"
          >
            <WelcomeScreen onUpload={setActiveDoc} />
          </motion.div>
        ) : (
          <motion.div
            key="chat"
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 w-full h-full absolute inset-0"
          >
            <ChatView
              key={activeDoc.id}
              doc={activeDoc}
              onChangeDoc={setActiveDoc}
              onClear={() => setActiveDoc(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
