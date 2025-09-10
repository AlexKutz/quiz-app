import React from "react";
import { WelcomeSectionProps } from "../types";

const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  quizTitle,
  user,
  attemptsLeft,
  timeLimit,
  loading,
  onStartTest,
  onBackToQuizzes,
}) => {
  return (
    <div className="welcome-section">
      <h2>Welcome to {quizTitle}</h2>
      <p>Hello, {user?.fullName || user?.username || user?.name}!</p>
      <p>Time Limit: {timeLimit} minutes</p>
      <p>Attempts Left: {attemptsLeft}</p>
      <button onClick={onStartTest} disabled={loading}>
        {loading ? "Loading..." : "Start Test"}
      </button>
      <button onClick={onBackToQuizzes}>Back to Quizzes</button>
    </div>
  );
};

export default WelcomeSection;
