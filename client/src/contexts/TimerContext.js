import React, { createContext, useContext } from 'react';

const TimerContext = createContext();

export const TimerProvider = ({ children, timeRemaining, timeLimit }) => {
  return (
    <TimerContext.Provider value={{ timeRemaining, timeLimit }}>
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error('useTimer must be used within a TimerProvider');
  }
  return context;
};
