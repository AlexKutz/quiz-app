import React from "react";
import "./Results.css";
import MathJaxText from "./MathJaxText";

const Results = ({
  results,
  name,
  onReset,
  maxAttemptsReached,
  attemptsLeft,
  quizTitle,
  onBackToQuizzes,
  timeExpired,
}) => {
  // Якщо час вичерпано, але немає результатів, показуємо тільки повідомлення
  if (timeExpired && !results) {
    return (
      <div className="results-container">
        <h2 className="results-title">Час вичерпано</h2>
        <div className="time-expired-message">
          <p>Час на проходження тесту "{quizTitle}" вичерпано.</p>
          <p>Тест автоматично завершено.</p>
        </div>
        <div className="results-actions">
          <button onClick={onBackToQuizzes} className="back-to-quizzes-button">
            Повернутися до вибору тесту
          </button>
        </div>
      </div>
    );
  }

  // Якщо немає результатів і час не вичерпано, не показуємо нічого
  if (!results) return null;

  const correctCount = results.filter((r) => r.correct).length;
  const totalCount = results.length;
  const percentage = Math.round((correctCount / totalCount) * 100);

  const getScoreClass = () => {
    if (percentage >= 80) return "excellent";
    if (percentage >= 60) return "good";
    if (percentage >= 40) return "average";
    return "poor";
  };

  const renderAnswer = (result) => {
    if (result.questionType === "multiple_choice") {
      return (
        <div className="result-answer">
          <span className="answer-label">Ваша відповідь:</span>
          <MathJaxText
            className={`answer-text ${
              result.correct ? "correct" : "incorrect"
            }`}
          >
            {result.givenAnswer || "Не відповідно"}
          </MathJaxText>
        </div>
      );
    } else {
      return (
        <div className="result-answer">
          <span className="answer-label">Ваша відповідь:</span>
          <MathJaxText
            className={`answer-text ${
              result.correct ? "correct" : "incorrect"
            }`}
          >
            {result.givenAnswer || "Не відповідно"}
          </MathJaxText>
        </div>
      );
    }
  };

  return (
    <div className="results-container">
      {timeExpired && (
        <div className="time-expired-message">
          <h2 className="results-title">Час вичерпано</h2>
          <p>Час на проходження тесту "{quizTitle}" вичерпано.</p>
          <p>Тест автоматично завершено.</p>
        </div>
      )}

      <div className="results-header">
        <h2 className="results-title">Результати тесту</h2>
        <div className={`score-display ${getScoreClass()}`}>
          <div className="score-percentage">{percentage}%</div>
          <div className="score-fraction">
            {correctCount}/{totalCount}
          </div>
        </div>
      </div>

      <div className="student-info">
        <span className="student-name">Учень: {name}</span>
      </div>

      <div className="results-list">
        {results.map((result, index) => (
          <div
            key={result.id}
            className={`result-item ${
              result.correct ? "correct" : "incorrect"
            }`}
          >
            <div className="result-question">
              <span className="result-number">{index + 1}.</span>
              <MathJaxText className="result-text">
                {result.question}
              </MathJaxText>
            </div>
            {renderAnswer(result)}
            <div className="result-status">
              {result.correct ? (
                <span className="status-correct">✓ Правильно</span>
              ) : (
                <span className="status-incorrect">✗ Неправильно</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {attemptsLeft && !maxAttemptsReached ? (
        <div className="attempts-left">
          <span>Осталось спроб: {attemptsLeft}</span>
        </div>
      ) : null}

      {!maxAttemptsReached && (
        <div className="button-group">
          <button onClick={onReset} className="retry-button">
            Спробувати знову
          </button>
          {onBackToQuizzes && (
            <button
              onClick={onBackToQuizzes}
              className="back-to-quizzes-button"
            >
              Назад до тестів
            </button>
          )}
        </div>
      )}

      {maxAttemptsReached && (
        <div className="no-more-attempts">
          <p>Ви вичерпали всі спроби проходження тесту.</p>
        </div>
      )}
    </div>
  );
};

export default Results;
