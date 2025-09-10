import React, { createContext, useContext, ReactNode } from "react";
import { TimerContextType } from "../types";

const TimerContext = createContext<TimerContextType | undefined>(undefined);

interface TimerProviderProps {
  children: ReactNode;
  timeRemaining: number | null;
  timeLimit: number | null;
}

export const TimerProvider: React.FC<TimerProviderProps> = ({
  children,
  timeRemaining,
  timeLimit,
}) => {
  const timeExpired = timeRemaining !== null && timeRemaining <= 0;

  return (
    <TimerContext.Provider
      value={{
        timeRemaining: timeRemaining || 0,
        timeLimit: timeLimit || 0,
        timeExpired,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};

export const useTimer = (): TimerContextType => {
  const context = useContext(TimerContext);
  if (!context) {
    throw new Error("useTimer must be used within a TimerProvider");
  }
  return context;
};
