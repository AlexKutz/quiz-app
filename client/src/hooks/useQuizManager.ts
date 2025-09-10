import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { Question, Quiz, QuizResult, QuizManagerType } from "../types";

export const useQuizManager = (): QuizManagerType => {
  const { user, getAuthToken } = useAuth();

  // Стани для тестування
  const [name, setName] = useState<string>("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<QuizResult | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [maxAttemptsReached, setMaxAttemptsReached] = useState<boolean>(false);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [selectedQuiz, setSelectedQuiz] = useState<string | null>(null);
  const [quizTitle, setQuizTitle] = useState<string>("");
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [timeExpired, setTimeExpired] = useState<boolean>(false);
  const [currentAnswers, setCurrentAnswers] = useState<{
    [questionId: string]: number | string | { [leftIndex: string]: string };
  }>({});
  const [startTime, setStartTime] = useState<number | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<{
    [questionId: string]: number | string | { [leftIndex: string]: string };
  }>({});
  const [confettiShown, setConfettiShown] = useState<boolean>(false);

  // Використовуємо useRef для збереження поточної функції handleSubmit
  const handleSubmitRef = useRef<
    | ((answers: {
        [questionId: string]: number | string | { [leftIndex: string]: string };
      }) => Promise<void>)
    | null
  >(null);

  // Функція для завантаження списку учнів з конкретного тесту
  const loadStudentsFromQuiz = useCallback(
    async (quizId: string): Promise<void> => {
      try {
        const token = getAuthToken();
        const response = await fetch(`/quiz-info/${quizId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await response.json();
        console.log("Quiz info data:", data);
      } catch (error) {
        console.error("Ошибка загрузки информации о тесте:", error);
      }
    },
    [getAuthToken]
  );

  // Завантажуємо тести після авторизації
  useEffect(() => {
    if (user) {
      const loadQuizzes = async (): Promise<void> => {
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
      // Автоматично встановлюємо ім'я користувача
      const userName = user.fullName || user.username || user.name;
      if (userName) {
        setName(userName);
      }
    }
  }, [user, getAuthToken, loadStudentsFromQuiz]);

  const loadQuizInfo = async (quizId: string): Promise<void> => {
    try {
      const token = getAuthToken();
      const response = await fetch(`/quiz-info/${quizId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.quizTitle) {
        setQuizTitle(data.quizTitle);
      }
    } catch (error) {
      console.error("Ошибка загрузки информации о тесте:", error);
    }
  };

  // Функція для збереження відповіді на сервері
  const saveAnswerToServer = useCallback(
    async (
      questionId: string,
      answer: number | string | { [leftIndex: string]: string }
    ): Promise<void> => {
      if (!selectedQuiz || !user) return;

      const userName = user.fullName || user.username || user.name;
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
    [selectedQuiz, user, getAuthToken]
  );

  const loadQuestions = async (newAttempt: boolean = false): Promise<void> => {
    // Використовуємо ім'я авторизованого користувача
    const userName = user?.fullName || user?.username || user?.name || name;

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
        return;
      }

      if (data.completed) {
        const {
          name: savedName,
          results: savedResults,
          confettiShown: savedConfettiShown,
        } = data.results || data;
        setName(savedName);
        setResults(savedResults);
        setConfettiShown(savedConfettiShown || false);
        setIsCompleted(true);
        setQuizTitle(data.quizTitle || "");

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
        setConfettiShown(false);
        setMaxAttemptsReached(false);
        setAttemptsLeft(null);
        setQuizTitle(data.quizTitle || "");
        setTimeLimit(data.timeLimit);
        setTimeRemaining(data.timeRemaining);
        setTimeExpired(false);
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
    (answers: {
      [questionId: string]: number | string | { [leftIndex: string]: string };
    }): void => {
      setCurrentAnswers(answers);

      // Знаходимо змінені відповіді і зберігаємо їх
      Object.keys(answers).forEach((qId) => {
        const newAnswer = answers[qId];
        const oldAnswer = savedAnswers[qId];

        if (newAnswer !== oldAnswer) {
          saveAnswerToServer(qId, newAnswer);
        }
      });

      setSavedAnswers(answers);
    },
    [savedAnswers, saveAnswerToServer]
  );

  const handleSubmit = useCallback(
    async (answers: {
      [questionId: string]: number | string | { [leftIndex: string]: string };
    }): Promise<void> => {
      console.log("Starting submit with:", {
        selectedQuiz,
        answers,
        userName: user?.fullName || user?.username || user?.name || name,
        startTime,
      });

      if (!selectedQuiz) {
        console.error("No quiz selected");
        alert("Ошибка: тест не выбран");
        return;
      }

      const userName = user?.fullName || user?.username || user?.name || name;
      if (!userName || userName.trim() === "") {
        console.error("No user name or empty user name:", userName);
        alert("Ошибка: имя пользователя не найдено или пустое");
        return;
      }

      // Проверяем, что answers не пустой
      if (!answers || Object.keys(answers).length === 0) {
        console.error("No answers provided:", answers);
        alert("Ошибка: нет ответов для отправки");
        return;
      }

      console.log("Data validation passed:", {
        userName: userName.trim(),
        answersCount: Object.keys(answers).length,
        answers: answers,
      });

      setLoading(true);
      try {
        const token = getAuthToken();
        const requestBody = {
          name: userName.trim(),
          answers,
          startTime: startTime,
        };

        console.log("Sending request body:", requestBody);

        const response = await fetch(`/submit/${selectedQuiz}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        });

        console.log("Response status:", response.status);
        console.log(
          "Response headers:",
          Object.fromEntries(response.headers.entries())
        );

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Server error:", errorData);
          alert(`Ошибка сервера: ${errorData.error || "Неизвестная ошибка"}`);
          return;
        }

        const data = await response.json();
        console.log("Submit response data:", data);

        if (data.timeExpired) {
          console.log("Time expired, setting timeExpired to true");
          setTimeExpired(true);
          setIsCompleted(true);
          return;
        }

        if (!data.results) {
          console.error("No results in response:", data);
          alert("Ошибка: результаты не получены");
          return;
        }

        console.log("Setting results and completing test");
        setResults(data.results);
        setConfettiShown(data.confettiShown || false);
        setIsCompleted(true);

        if (data.maxAttemptsReached) {
          setMaxAttemptsReached(true);
          setAttemptsLeft(0);
        } else {
          const selectedQuizData = quizzes.find((q) => q.id === selectedQuiz);
          if (selectedQuizData) {
            setAttemptsLeft(selectedQuizData.maxAttempts - data.attempts);
          }
        }
      } catch (error) {
        console.error("Ошибка отправки:", error);
        alert("Ошибка отправки данных");
      } finally {
        setLoading(false);
      }
    },
    [selectedQuiz, user, quizzes, startTime, name, getAuthToken]
  );

  // Оновлюємо ref при зміні handleSubmit
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Добавляем функцию для отметки конфетти как показанного
  const markConfettiShown = useCallback(async (): Promise<void> => {
    if (!selectedQuiz || !user) return;

    const userName = user.fullName || user.username || user.name;
    if (!userName) return;

    try {
      const token = getAuthToken();
      await fetch(`/mark-confetti-shown/${selectedQuiz}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          studentName: userName,
        }),
      });

      // Обновляем локальное состояние
      setConfettiShown(true);
    } catch (error) {
      console.error("Error marking confetti as shown:", error);
    }
  }, [selectedQuiz, user, getAuthToken]);

  // Таймер - виправлений useEffect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (timeRemaining && timeRemaining > 0 && !isCompleted) {
      interval = setInterval(() => {
        setTimeRemaining((time) => {
          if (time && time <= 1) {
            // Використовуємо ref замість прямої залежності
            if (handleSubmitRef.current) {
              handleSubmitRef.current(currentAnswers);
            }
            setTimeExpired(true);
            setIsCompleted(true);
            return 0;
          }
          return time ? time - 1 : 0;
        });
      }, 1000);
    } else if (timeRemaining === 0) {
      // Використовуємо ref замість прямої залежності
      if (handleSubmitRef.current) {
        handleSubmitRef.current(currentAnswers);
      }
      setTimeExpired(true);
      setIsCompleted(true);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timeRemaining, isCompleted, currentAnswers]); // Видаляємо handleSubmit з залежностей

  const resetTest = (): void => {
    if (maxAttemptsReached) {
      alert("Ви вичерпали всі спроби проходження тесту.");
      return;
    }

    setQuestions([]);
    setResults(null);
    setConfettiShown(false);
    setIsCompleted(false);
    setTimeExpired(false);
    setTimeRemaining(null);
    setCurrentAnswers({});
    setSavedAnswers({});
    setStartTime(null);
    loadQuestions(true);
  };

  const resetToQuizSelection = (): void => {
    setSelectedQuiz(null);
    setQuestions([]);
    setResults(null);
    setConfettiShown(false);
    setIsCompleted(false);
    setMaxAttemptsReached(false);
    setAttemptsLeft(null);
    setQuizTitle("");
    setTimeLimit(null);
    setTimeRemaining(null);
    setTimeExpired(false);
    setCurrentAnswers({});
    setSavedAnswers({});
    setName("");
    setStartTime(null);
  };

  const selectQuiz = (quizId: string): void => {
    setSelectedQuiz(quizId);
    loadQuizInfo(quizId);
  };

  return {
    // Стани
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

    // Функції
    loadQuestions,
    handleAnswersChange,
    handleSubmit,
    resetTest,
    resetToQuizSelection,
    selectQuiz,
    markConfettiShown,
  };
};
