import React from "react";
import "./WelcomeSection.css";

const WelcomeSection = ({
  quizTitle,
  user,
  attemptsLeft,
  timeLimit,
  loading,
  onStartTest,
  onBackToQuizzes,
}) => {
  console.log("WelcomeSection", {
    quizTitle,
    user,
    attemptsLeft,
    timeLimit,
    loading,
    onStartTest,
    onBackToQuizzes,
  });
  return (
    <div className="welcome-section">
      <div className="welcome-header">
        <h2 className="quiz-title">{quizTitle}</h2>
        <div className="welcome-subtitle">Готові почати тестування?</div>
      </div>

      <div className="welcome-content">
        <div className="user-card">
          <div className="user-avatar">
            <span className="avatar-icon">👤</span>
          </div>
          <div className="user-details">
            <div className="user-label">Користувач</div>
            <div className="user-name">{user?.fullName || user?.username}</div>
          </div>
        </div>

        <div className="quiz-details">
          {attemptsLeft && (
            <div className="detail-card attempts-card">
              <div className="detail-icon">🔄</div>
              <div className="detail-content">
                <div className="detail-label">Залишилось спроб</div>
                <div className="detail-value">{attemptsLeft}</div>
              </div>
            </div>
          )}

          {timeLimit && (
            <div className="detail-card time-card">
              <div className="detail-icon">⏱️</div>
              <div className="detail-content">
                <div className="detail-label">Час на тест</div>
                <div className="detail-value">{timeLimit} хв</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="welcome-actions">
        <button
          onClick={onStartTest}
          className="start-button"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="loading-spinner"></span>
              Завантаження...
            </>
          ) : (
            <>
              <span className="btn-icon">🚀</span>
              Почати тест
            </>
          )}
        </button>

        <button onClick={onBackToQuizzes} className="back-button">
          <span className="btn-icon">←</span>
          Назад до вибору тесту
        </button>
      </div>
    </div>
  );
};

export default WelcomeSection;
