import React from "react";
import "./QuizSelection.css";

const QuizSelection = ({ quizzes, onQuizSelect }) => {
  return (
    <div className="quiz-selection">
      <h2 className="quiz-selection-title">Оберіть тест</h2>
      <div className="quizzes-grid">
        {quizzes.map((quiz) => (
          <div
            key={quiz.id}
            className="quiz-card"
            onClick={() => onQuizSelect(quiz.id)}
          >
            <div className="quiz-card-header">
              <h3 className="quiz-title">{quiz.title}</h3>
            </div>

            <div className="quiz-info">
              <div className="info-item">
                <div className="info-icon">📝</div>
                <div className="info-content">
                  <span className="info-label">Питання</span>
                  <span className="info-value">
                    {quiz.randomQuestionsCount}
                  </span>
                </div>
              </div>

              {quiz.maxAttempts > 1 && (
                <div className="info-item">
                  <div className="info-icon">🔄</div>
                  <div className="info-content">
                    <span className="info-label">Спроби</span>
                    <span className="info-value">{quiz.maxAttempts}</span>
                  </div>
                </div>
              )}

              <div className="info-item">
                <div className="info-icon">⏱️</div>
                <div className="info-content">
                  <span className="info-label">Час</span>
                  <span className="info-value">
                    {quiz.timeLimit ? `${quiz.timeLimit} хв` : "Без обмежень"}
                  </span>
                </div>
              </div>
            </div>

            <div className="quiz-card-footer">
              <button className="start-quiz-btn">
                Почати тест
                <span className="btn-arrow">→</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuizSelection;
