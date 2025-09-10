import React from "react";
import { ResultsProps } from "../types";

const Results: React.FC<ResultsProps> = ({
  results,
  name,
  onReset,
  maxAttemptsReached,
  attemptsLeft,
  quizTitle,
  onBackToQuizzes,
  timeExpired,
  confettiShown,
  onMarkConfettiShown: _onMarkConfettiShown,
}) => {
  return (
    <div className="results">
      <h2>Results for {name}</h2>
      <p>Quiz: {quizTitle}</p>
      {results && (
        <div>
          <p>
            Score: {results.score}/{results.totalQuestions}
          </p>
          <p>Correct: {results.correctAnswers}</p>
        </div>
      )}
      {attemptsLeft !== null && <p>Attempts left: {attemptsLeft}</p>}
      {timeExpired && <p>Time expired!</p>}
      <button onClick={onReset} disabled={maxAttemptsReached}>
        Reset Test
      </button>
      <button onClick={onBackToQuizzes}>Back to Quizzes</button>
      {confettiShown && <div>Confetti animation completed</div>}
    </div>
  );
};

export default Results;
