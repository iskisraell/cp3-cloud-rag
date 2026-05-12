import { useState, useEffect } from 'react';

export function useStreamingText(text: string, isStreaming: boolean, onComplete?: () => void) {
  const [displayedText, setDisplayedText] = useState('');

  useEffect(() => {
    if (!isStreaming) {
      setDisplayedText(text);
      return;
    }

    setDisplayedText('');
    let i = 0;
    
    // Slight initial delay to simulate "thinking" before typing if needed, 
    // but the spec just says 20ms per char.
    const interval = setInterval(() => {
      setDisplayedText((prev) => prev + text.charAt(i));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        onComplete?.();
      }
    }, 20);

    return () => clearInterval(interval);
  }, [text, isStreaming, onComplete]);

  return displayedText;
}
