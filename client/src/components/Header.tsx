import React from "react";
import "./Header.css";
import { ArrowIcon } from "./Icons/ArrowIcon";
import { User } from "../types";

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
  quizTitle?: string | null;
  timeRemaining?: number | null;
  isCompleted?: boolean;
  backToQuizzes?: () => void;
  showAdminPanel?: boolean;
}

const Header: React.FC<HeaderProps> = ({
  user,
  onLogout,
  quizTitle,
  timeRemaining,
  isCompleted,
  backToQuizzes,
  showAdminPanel = false,
}) => {
  const formatTime = (seconds: number | null | undefined): string => {
    if (seconds === null || seconds === undefined) return "";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const onBackToQuizzes = (): void => {
    // TODO: Change function to react router
    if (backToQuizzes) {
      backToQuizzes();
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        {quizTitle && backToQuizzes && (
          <ArrowIcon
            onClick={onBackToQuizzes}
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
                  Привіт, {user.fullName || user.username || user.name}!
                </span>
                {user.role === "admin" && !showAdminPanel && (
                  <button
                    className="admin-btn"
                    onClick={() => window.location.reload()}
                    title="Панель адміністратора"
                  >
                    Адмін
                  </button>
                )}
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
