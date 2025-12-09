import { useCallback } from 'react';

// Web Audio API based notification sounds
export function useNotificationSound() {
  const playSound = useCallback((type: 'capture' | 'complete' | 'success' | 'error') => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      // Different sound patterns for different events
      switch (type) {
        case 'capture':
          // Short beep for capture progress
          oscillator.frequency.value = 880; // A5
          oscillator.type = 'sine';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.05);
          break;
          
        case 'complete':
          // Pleasant rising tone for completion
          oscillator.frequency.setValueAtTime(523, audioContext.currentTime); // C5
          oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1); // E5
          oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2); // G5
          oscillator.type = 'sine';
          gainNode.gain.value = 0.15;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
          break;
          
        case 'success':
          // Double beep for success
          oscillator.frequency.value = 1047; // C6
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.1);
          gainNode.gain.setValueAtTime(0.15, audioContext.currentTime + 0.15);
          gainNode.gain.setValueAtTime(0, audioContext.currentTime + 0.25);
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
          break;
          
        case 'error':
          // Low tone for error
          oscillator.frequency.value = 220; // A3
          oscillator.type = 'square';
          gainNode.gain.value = 0.1;
          oscillator.start();
          oscillator.stop(audioContext.currentTime + 0.3);
          break;
      }
    } catch (error) {
      console.log('Audio not supported:', error);
    }
  }, []);

  return { playSound };
}
