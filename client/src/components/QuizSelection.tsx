import React from "react";
import { QuizSelectionProps } from "../types";

const QuizSelection: React.FC<QuizSelectionProps> = ({ quizzes, onQuizSelect }) => {
  return (
    <div className="quiz-selection">
      <h2>Select a Quiz</h2>
      {quizzes.map((quiz) => (
        <div key={quiz.id} className="quiz-item">
          <h3>{quiz.title}</h3>
          <p>{quiz.description}</p>
          <p>Time Limit: {quiz.timeLimit} minutes</p>
          <p>Max Attempts: {quiz.maxAttempts}</p>
          <button onClick={() => onQuizSelect(quiz.id)}>
            Start Quiz
          </button>
        </div>
      ))}
    </div>
  );
};

export default QuizSelection;
