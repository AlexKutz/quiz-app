import React, { useState, useEffect, useCallback } from "react";
import "./App.css";
import TestForm from "./components/TestForm";
import Results from "./components/Results";
import Header from "./components/Header";

function App() {
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

  useEffect(() => {
    const loadQuizzes = async () => {
      try {
        const response = await fetch("/quizzes");
        const data = await response.json();
        console.log("Quizzes data:", data);
        setQuizzes(data);

        // Завантажуємо список учнів з першого доступного тесту
        if (data.length > 0) {
          await loadStudentsFromQuiz(data[0].id);
        }
      } catch (error) {
        console.error("Ошибка загрузки тестов:", error);
      }
    };

    loadQuizzes();
  }, []);

  // Функція для завантаження списку учнів з конкретного тесту
  const loadStudentsFromQuiz = async (quizId) => {
    try {
      const response = await fetch(`/quiz-info/${quizId}`);
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
      const response = await fetch(`/quiz-info/${quizId}`);
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
      if (!selectedQuiz || !name) return;

      try {
        const response = await fetch(`/save-answer/${selectedQuiz}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            studentName: name,
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
    [selectedQuiz, name]
  );

  const loadQuestions = async (newAttempt = false) => {
    if (!name.trim()) {
      alert("Оберіть ваше ім'я зі списку");
      return;
    }

    if (!selectedQuiz) {
      alert("Оберіть тест");
      return;
    }

    setLoading(true);
    try {
      const url = newAttempt
        ? `/questions/${selectedQuiz}?newAttempt=true&studentName=${encodeURIComponent(
            name
          )}`
        : `/questions/${selectedQuiz}?studentName=${encodeURIComponent(name)}`;
      const response = await fetch(url);
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
        const response = await fetch(`/submit/${selectedQuiz}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
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
    [selectedQuiz, name, quizzes, startTime]
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

  return (
    <div className="App">
      <Header />
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
                <select
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="name-input"
                >
                  <option value="">Оберіть ваше ім'я</option>
                  {students.map((student, index) => (
                    <option key={index} value={student}>
                      {student}
                    </option>
                  ))}
                </select>
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
