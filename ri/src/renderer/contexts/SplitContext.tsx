import React, { createContext, useContext } from 'react';

interface SplitContextType {
  splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => Promise<void>;
}

const SplitContext = createContext<SplitContextType | null>(null);

export const SplitProvider: React.FC<{
  children: React.ReactNode;
  splitTerminal: (terminalId: string, direction: 'horizontal' | 'vertical') => Promise<void>;
}> = ({ children, splitTerminal }) => {
  return (
    <SplitContext.Provider value={{ splitTerminal }}>
      {children}
    </SplitContext.Provider>
  );
};

export const useSplit = () => {
  const context = useContext(SplitContext);
  if (!context) {
    throw new Error('useSplit must be used within a SplitProvider');
  }
  return context;
};