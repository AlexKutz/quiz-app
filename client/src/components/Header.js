import React from "react";
import "./Header.css";
import { ArrowIcon } from "./Icons/ArrowIcon";

const Header = ({
  user,
  onLogout,
  name,
  quizTitle,
  timeRemaining,
  timeExpired,
  isCompleted,
  backToQuizzes,
}) => {
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return "";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const onBackToQuizzes = (e) => {
    // TODO: Change function to react router
    backToQuizzes();
  };

  return (
    <header className="header">
      <div className="header-content">
        {quizTitle && (
          <ArrowIcon
            onClick={() => onBackToQuizzes()}
            className="header-icon"
          />
        )}

        <div className="header-left"></div>

        <div className="header-right">
          {timeRemaining !== null && !isCompleted && (
            <div className={`timer`}>
              Залишилось: {formatTime(timeRemaining)}
            </div>
          )}

          <div className="user-info">
            {user && (
              <>
                <span className="user-greeting">
                  Привіт, {user.fullName || user.username}!
                </span>
                <button className="logout-btn" onClick={onLogout}>
                  Вийти
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
