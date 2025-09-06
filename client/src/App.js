import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import TestForm from "./components/TestForm";
import Results from "./components/Results";
import Header from "./components/Header";
import Auth from "./components/Auth";

function App() {
  // Стани для авторизації
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Стани для тестування
  const [name, setName] = useState("");
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [quizTitle, setQuizTitle] = useState("");
  const [timeLimit, setTimeLimit] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [currentAnswers, setCurrentAnswers] = useState({});
  const [students, setStudents] = useState([]);
  const [startTime, setStartTime] = useState(null);
  const [savedAnswers, setSavedAnswers] = useState({});

  // Функція для отримання токена з localStorage
  const getAuthToken = () => {
    return localStorage.getItem("authToken");
  };

  // Функція для перевірки авторизації
  const checkAuth = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setAuthLoading(false);
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        setUser(result.user);
        setIsAuthenticated(true);
        // Автоматично встановлюємо ім'я користувача
        setName(result.user.fullName || result.user.username);
      } else {
        localStorage.removeItem("authToken");
        localStorage.removeItem("userName");
      }
    } catch (error) {
      console.error("Auth check error:", error);
      localStorage.removeItem("authToken");
      localStorage.removeItem("userName");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Функція для входу в систему
  const handleLogin = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    // Автоматично встановлюємо ім'я користувача
    setName(userData.fullName || userData.username);
  };

  // Функція для виходу з системи
  const handleLogout = async () => {
    try {
      const token = getAuthToken();
      if (token) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userName");
      setUser(null);
      setIsAuthenticated(false);
      // Скидаємо всі стани тестування
      resetToQuizSelection();
    }
  };

  // Перевіряємо авторизацію при завантаженні
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Завантажуємо тести тільки після авторизації
  useEffect(() => {
    if (isAuthenticated) {
      const loadQuizzes = async () => {
        try {
          const token = getAuthToken();
          const response = await fetch("/quizzes", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const data = await response.json();
          console.log("Quizzes data:", data);
          setQuizzes(data.quizzes || data);

          // Завантажуємо список учнів з першого доступного тесту
          if (data.quizzes && data.quizzes.length > 0) {
            await loadStudentsFromQuiz(data.quizzes[0].id);
          } else if (data.length > 0) {
            await loadStudentsFromQuiz(data[0].id);
          }
        } catch (error) {
          console.error("Ошибка загрузки тестов:", error);
        }
      };

      loadQuizzes();
    }
  }, [isAuthenticated]);

  // Функція для завантаження списку учнів з конкретного тесту
  const loadStudentsFromQuiz = async (quizId) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/quiz-info/${quizId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      console.log("Quiz info data:", data);
      if (data.students) {
        setStudents(data.students);
      }
    } catch (error) {
      console.error("Ошибка загрузки информации о тесте:", error);
    }
  };

  const loadQuizInfo = async (quizId) => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/quiz-info/${quizId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      console.log("Quiz info data:", data);
      if (data.students) {
        setStudents(data.students);
      }
      if (data.quizTitle) {
        setQuizTitle(data.quizTitle);
      }
    } catch (error) {
      console.error("Ошибка загрузки информации о тесте:", error);
    }
  };

  // Функція для збереження відповіді на сервері
  const saveAnswerToServer = useCallback(
    async (questionId, answer) => {
      if (!selectedQuiz || !user) return;

      const userName = user.fullName || user.username;
      if (!userName) return;

      try {
        const token = getAuthToken();
        const response = await fetch(`/save-answer/${selectedQuiz}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            studentName: userName,
            questionId: questionId,
            answer: answer,
          }),
        });

        if (response.ok) {
          console.log(`Answer saved for question ${questionId}`);
        } else {
          console.error("Failed to save answer:", response.statusText);
        }
      } catch (error) {
        console.error("Error saving answer:", error);
      }
    },
    [selectedQuiz, user]
  );

  const loadQuestions = async (newAttempt = false) => {
    // Використовуємо ім'я авторизованого користувача
    const userName = user?.fullName || user?.username || name;

    if (!userName?.trim()) {
      alert("Помилка: не вдалося отримати ім'я користувача");
      return;
    }

    if (!selectedQuiz) {
      alert("Оберіть тест");
      return;
    }

    setLoading(true);
    try {
      const token = getAuthToken();
      const url = newAttempt
        ? `/questions/${selectedQuiz}?newAttempt=true&studentName=${encodeURIComponent(
            userName
          )}`
        : `/questions/${selectedQuiz}?studentName=${encodeURIComponent(
            userName
          )}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      console.log("Quiz data:", data);

      if (data.timeExpired) {
        setTimeExpired(true);
        setIsCompleted(true);
        setQuizTitle(data.quizTitle || "");
        setStudents(data.students || []);
        return;
      }

      if (data.completed) {
        const { name: savedName, results: savedResults } = data.results || data;
        setName(savedName);
        setResults(savedResults);
        setIsCompleted(true);
        setQuizTitle(data.quizTitle || "");
        setStudents(data.students || []);

        if (data.maxAttemptsReached) {
          setMaxAttemptsReached(true);
          setAttemptsLeft(0);
        } else if (data.attemptsLeft) {
          setAttemptsLeft(data.attemptsLeft);
          setMaxAttemptsReached(false);
        }
      } else {
        setQuestions(data.questions);
        setIsCompleted(false);
        setResults(null);
        setMaxAttemptsReached(false);
        setAttemptsLeft(null);
        setQuizTitle(data.quizTitle || "");
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeRemaining);
        setTimeExpired(false);
        setStudents(data.students || []);
        setStartTime(data.startTime);

        // Відновлюємо збережені відповіді
        if (data.savedAnswers) {
          setSavedAnswers(data.savedAnswers);
          setCurrentAnswers(data.savedAnswers);
        } else {
          setSavedAnswers({});
          setCurrentAnswers({});
        }
      }
    } catch (error) {
      console.error("Ошибка загрузки:", error);
      alert("Ошибка загрузки данных");
    } finally {
      setLoading(false);
    }
  };

  // Функція для обробки зміни відповідей з автоматичним збереженням
  const handleAnswersChange = useCallback(
    (newAnswers) => {
      setCurrentAnswers(newAnswers);

      // Знаходимо змінені відповіді і зберігаємо їх
      Object.keys(newAnswers).forEach((questionId) => {
        const newAnswer = newAnswers[questionId];
        const oldAnswer = savedAnswers[questionId];

        if (newAnswer !== oldAnswer) {
          saveAnswerToServer(questionId, newAnswer);
        }
      });

      setSavedAnswers(newAnswers);
    },
    [savedAnswers, saveAnswerToServer]
  );

  const handleSubmit = useCallback(
    async (answers) => {
      setLoading(true);
      try {
        const token = getAuthToken();
        const userName = user?.fullName || user?.username || name;
        const response = await fetch(`/submit/${selectedQuiz}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            name: userName,
            answers,
            startTime: startTime,
          }),
        });

        const data = await response.json();

        if (data.timeExpired) {
          setTimeExpired(true);
          setIsCompleted(true);
          return;
        }

        setResults(data.results);
        setIsCompleted(true);

        if (data.maxAttemptsReached) {
          setMaxAttemptsReached(true);
          setAttemptsLeft(0);
        } else {
          const selectedQuizData = quizzes.find((q) => q.id === selectedQuiz);
          setAttemptsLeft(selectedQuizData.maxAttempts - data.attempts);
        }
      } catch (error) {
        console.error("Ошибка отправки:", error);
        alert("Ошибка отправки данных");
      } finally {
        setLoading(false);
      }
    },
    [selectedQuiz, user, quizzes, startTime, name]
  );

  // Загрузка списка доступных тестов
  useEffect(() => {
    let interval = null;

    if (timeRemaining > 0 && !isCompleted) {
      interval = setInterval(() => {
        setTimeRemaining((time) => {
          if (time <= 1) {
            // Автоматично відправляємо відповіді при вичерпанні часу
            handleSubmit(currentAnswers);
            setTimeExpired(true);
            setIsCompleted(true);
            return 0;
          }
          return time - 1;
        });
      }, 1000);
    } else if (timeRemaining === 0) {
      // Автоматично відправляємо відповіді при вичерпанні часу
      handleSubmit(currentAnswers);
      setTimeExpired(true);
      setIsCompleted(true);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timeRemaining, isCompleted, currentAnswers, handleSubmit]);

  const resetTest = () => {
    if (maxAttemptsReached) {
      alert("Ви вичерпали всі спроби проходження тесту.");
      return;
    }

    setQuestions([]);
    setResults(null);
    setIsCompleted(false);
    setTimeExpired(false);
    setTimeRemaining(null);
    setCurrentAnswers({});
    setSavedAnswers({});
    setStartTime(null);
    loadQuestions(true);
  };

  const resetToQuizSelection = () => {
    setSelectedQuiz(null);
    setQuestions([]);
    setResults(null);
    setIsCompleted(false);
    setMaxAttemptsReached(false);
    setAttemptsLeft(null);
    setQuizTitle("");
    setTimeLimit(null);
    setTimeRemaining(null);
    setTimeExpired(false);
    setCurrentAnswers({});
    setSavedAnswers({});
    setStudents([]);
    setName("");
    setStartTime(null);
  };

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
            <h1>Система тестування</h1>
            <p>Увійдіть в систему для проходження тестів</p>
          </div>
          <Auth onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  // Основний інтерфейс для авторизованих користувачів
  return (
    <div className="App">
      <Header
        user={user}
        onLogout={handleLogout}
        name={name}
        quizTitle={quizTitle}
        timeRemaining={timeRemaining}
        timeExpired={timeExpired}
      />
      <main className="main-content">
        <div className="container">
          {!selectedQuiz && (
            <div className="quiz-selection">
              <h2 className="quiz-selection-title">Оберіть тест</h2>
              <div className="quizzes-grid">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className="quiz-card"
                    onClick={() => {
                      setSelectedQuiz(quiz.id);
                      loadQuizInfo(quiz.id);
                    }}
                  >
                    <h3>{quiz.title}</h3>
                    <p>
                      Питання: {quiz.randomQuestionsCount} з{" "}
                      {quiz.totalQuestions}
                    </p>
                    <p>Спроби: {quiz.maxAttempts}</p>
                    {quiz.timeLimit && <p>Час: {quiz.timeLimit} хв</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedQuiz && !isCompleted && !questions.length && (
            <div className="welcome-section">
              <h2>{quizTitle}</h2>
              <div className="user-info">
                <p>
                  Користувач:{" "}
                  <strong>{user?.fullName || user?.username}</strong>
                </p>
              </div>
              {attemptsLeft && (
                <div className="attempts-info">
                  <p>
                    У вас залишилося спроб: <strong>{attemptsLeft}</strong>
                  </p>
                </div>
              )}
              {timeLimit && (
                <div className="time-info">
                  <p>
                    Час на проходження: <strong>{timeLimit} хвилин</strong>
                  </p>
                </div>
              )}
              <div className="input-group">
                <button
                  onClick={() => loadQuestions()}
                  className="start-button"
                  disabled={loading}
                >
                  {loading ? "Завантаження..." : "Почати тест"}
                </button>
                <button onClick={resetToQuizSelection} className="back-button">
                  Назад до вибору тесту
                </button>
              </div>
            </div>
          )}

          {questions.length > 0 && !isCompleted && (
            <TestForm
              questions={questions}
              onSubmit={handleSubmit}
              loading={loading}
              quizTitle={quizTitle}
              timeRemaining={timeRemaining}
              timeLimit={timeLimit}
              onAnswersChange={handleAnswersChange}
              savedAnswers={savedAnswers}
            />
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
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
