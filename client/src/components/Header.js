import React from "react";
import "./Header.css";

const Header = ({ user, onLogout, name, quizTitle, timeRemaining, timeExpired }) => {
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="header-left">
          <h1>Система тестування</h1>
          {quizTitle && <h2>{quizTitle}</h2>}
        </div>
        
        <div className="header-right">
          {timeRemaining !== null && (
            <div className={`timer ${timeExpired ? 'expired' : ''}`}>
              {timeExpired ? 'Час вичерпано' : `Залишилось: ${formatTime(timeRemaining)}`}
            </div>
          )}
          
          <div className="user-info">
            {user && (
              <span>Привіт, {user.fullName || user.username}!</span>
            )}
            {name && (
              <span className="student-name">Студент: {name}</span>
            )}
            <button className="logout-btn" onClick={onLogout}>
              Вийти
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
