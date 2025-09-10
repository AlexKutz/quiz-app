import React from "react";
import "./App.css";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TimerProvider } from "./contexts/TimerContext";
import { useQuizManager } from "./hooks/useQuizManager";
import TestForm from "./components/TestForm";
import Results from "./components/Results";
import Header from "./components/Header";
import Auth from "./components/Auth";
import QuizSelection from "./components/QuizSelection";
import WelcomeSection from "./components/WelcomeSection";
import AdminPanel from "./components/AdminPanel";

const AppContent: React.FC = () => {
  const { user, isAuthenticated, authLoading, handleLogin, handleLogout } =
    useAuth();
  const {
    name,
    questions,
    results,
    isCompleted,
    loading,
    maxAttemptsReached,
    attemptsLeft,
    quizzes,
    selectedQuiz,
    quizTitle,
    timeLimit,
    timeRemaining,
    timeExpired,
    savedAnswers,
    confettiShown,
    loadQuestions,
    handleAnswersChange,
    handleSubmit,
    resetTest,
    resetToQuizSelection,
    selectQuiz,
    markConfettiShown,
  } = useQuizManager();

  // Показуємо завантаження авторизації
  if (authLoading) {
    return (
      <div className="App">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Завантаження...</p>
        </div>
      </div>
    );
  }

  // Показуємо форму авторизації, якщо користувач не авторизований
  if (!isAuthenticated) {
    return (
      <div className="App">
        <div className="auth-page">
          <div className="auth-header">
            <p>Увійдіть в систему для проходження тестів</p>
          </div>
          <Auth onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  // Показуємо панель адміністратора, якщо користувач - адміністратор
  if (user && user.role === "admin") {
    return (
      <div className="App">
        <Header user={user} onLogout={handleLogout} showAdminPanel={true} />
        <main className="main-content">
          <AdminPanel />
        </main>
      </div>
    );
  }

  // Основний інтерфейс для авторизованих користувачів
  return (
    <div className="App">
      <Header
        user={user}
        onLogout={handleLogout}
        quizTitle={quizTitle}
        timeRemaining={timeRemaining}
        isCompleted={isCompleted}
        backToQuizzes={resetToQuizSelection}
      />
      <main className="main-content">
        <div className="container">
          {!selectedQuiz && (
            <QuizSelection quizzes={quizzes} onQuizSelect={selectQuiz} />
          )}

          {selectedQuiz && quizTitle && !isCompleted && !questions.length && (
            <WelcomeSection
              quizTitle={quizTitle}
              user={user}
              attemptsLeft={attemptsLeft}
              timeLimit={timeLimit}
              loading={loading}
              onStartTest={() => loadQuestions()}
              onBackToQuizzes={resetToQuizSelection}
            />
          )}

          {questions.length > 0 &&
            !isCompleted &&
            timeRemaining !== null &&
            timeLimit !== null && (
              <TimerProvider
                timeRemaining={timeRemaining}
                timeLimit={timeLimit}
              >
                <TestForm
                  questions={questions}
                  onSubmit={handleSubmit}
                  loading={loading}
                  quizTitle={quizTitle}
                  onAnswersChange={handleAnswersChange}
                  savedAnswers={savedAnswers}
                />
              </TimerProvider>
            )}

          {isCompleted && (results || timeExpired) && (
            <Results
              results={results}
              name={name}
              onReset={resetTest}
              maxAttemptsReached={maxAttemptsReached}
              attemptsLeft={attemptsLeft}
              quizTitle={quizTitle}
              onBackToQuizzes={resetToQuizSelection}
              timeExpired={timeExpired}
              confettiShown={confettiShown}
              onMarkConfettiShown={markConfettiShown}
            />
          )}

          {/* Добавляем отладочную информацию для диагностики */}
          {isCompleted && !results && !timeExpired && (
            <div
              className="debug-info"
              style={{
                padding: "20px",
                border: "1px solid red",
                margin: "20px",
              }}
            >
              <h2>Отладка - Проблема с отображением результатов</h2>
              <p>
                <strong>isCompleted:</strong> {isCompleted.toString()}
              </p>
              <p>
                <strong>results:</strong> {results ? "есть" : "нет"}
              </p>
              <p>
                <strong>timeExpired:</strong> {timeExpired.toString()}
              </p>
              <p>
                <strong>loading:</strong> {loading.toString()}
              </p>
              <p>
                <strong>selectedQuiz:</strong> {selectedQuiz || "не выбран"}
              </p>
              <p>
                <strong>quizTitle:</strong> {quizTitle || "не установлен"}
              </p>
              <button
                onClick={resetToQuizSelection}
                style={{ padding: "10px", margin: "10px" }}
              >
                Вернуться к тестам
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
