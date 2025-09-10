import React, { useState, useEffect } from "react";
import "./AdminPanel.css";

const AdminPanel = () => {
  const [results, setResults] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedQuiz, setSelectedQuiz] = useState("all");
  const [currentView, setCurrentView] = useState("results"); // results, stats, quizzes
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [resultsRes, quizzesRes, statsRes] = await Promise.all([
        fetch("/admin/results", {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }),
        fetch("/admin/quizzes", {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }),
        fetch("/admin/stats", {
          credentials: "include",
          headers: {
            Authorization: `Bearer ${localStorage.getItem("authToken")}`,
          },
        }),
      ]);

      if (!resultsRes.ok || !quizzesRes.ok || !statsRes.ok) {
        throw new Error("Помилка завантаження даних");
      }

      const [resultsData, quizzesData, statsData] = await Promise.all([
        resultsRes.json(),
        quizzesRes.json(),
        statsRes.json(),
      ]);

      setResults(resultsData.results || []);
      setQuizzes(quizzesData.quizzes || []);
      setStats(statsData.stats || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const url =
        selectedQuiz === "all"
          ? "/admin/export"
          : `/admin/export?quizId=${selectedQuiz}`;

      const response = await fetch(url, {
        credentials: "include",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Помилка експорту");
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `results_${
        selectedQuiz === "all" ? "all" : selectedQuiz
      }_${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setError(err.message);
    }
  };

  const filteredResults =
    selectedQuiz === "all"
      ? results
      : results.filter((result) => result.quiz_id === selectedQuiz);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString("uk-UA");
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FF9800";
    return "#F44336";
  };

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="loading">Завантаження...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-panel">
        <div className="error">Помилка: {error}</div>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h1>Панель адміністратора</h1>
        <div className="admin-controls">
          <select
            value={selectedQuiz}
            onChange={(e) => setSelectedQuiz(e.target.value)}
            className="quiz-selector"
          >
            <option value="all">Всі тести</option>
            {quizzes.map((quiz) => (
              <option key={quiz.id} value={quiz.id}>
                {quiz.title}
              </option>
            ))}
          </select>
          <button onClick={handleExport} className="export-btn">
            Експорт CSV
          </button>
        </div>
      </div>

      <div className="admin-tabs">
        <button
          className={`tab ${currentView === "results" ? "active" : ""}`}
          onClick={() => setCurrentView("results")}
        >
          Результати
        </button>
        <button
          className={`tab ${currentView === "stats" ? "active" : ""}`}
          onClick={() => setCurrentView("stats")}
        >
          Статистика
        </button>
        <button
          className={`tab ${currentView === "quizzes" ? "active" : ""}`}
          onClick={() => setCurrentView("quizzes")}
        >
          Тести
        </button>
      </div>

      <div className="admin-content">
        {currentView === "results" && (
          <div className="results-view">
            <div className="results-header">
              <h2>Результати тестів</h2>
              <div className="results-count">
                Показано: {filteredResults.length} з {results.length}
              </div>
            </div>

            <div className="results-table-container">
              <table className="results-table">
                <thead>
                  <tr>
                    <th>Студент</th>
                    <th>Тест</th>
                    <th>Спроб</th>
                    <th>Середній бал</th>
                    <th>Правильних</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th>Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((result) => (
                    <tr key={result.id}>
                      <td>{result.name}</td>
                      <td>{result.quiz_title}</td>
                      <td>{result.attempts}</td>
                      <td>
                        <span
                          className="score"
                          style={{ color: getScoreColor(result.average_score) }}
                        >
                          {result.average_score.toFixed(1)}%
                        </span>
                      </td>
                      <td>{result.correct_count}</td>
                      <td>{formatDate(result.completed_at)}</td>
                      <td>
                        <div className="status-badges">
                          {result.auto_saved && (
                            <span className="badge auto-saved">
                              Автозбережено
                            </span>
                          )}
                          {result.time_expired && (
                            <span className="badge time-expired">
                              Час вичерпано
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="view-details-btn"
                          onClick={() => setSelectedResult(result)}
                        >
                          Деталі
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {currentView === "stats" && (
          <div className="stats-view">
            <h2>Статистика по тестах</h2>
            <div className="stats-grid">
              {stats.map((stat) => (
                <div key={stat.quiz_id} className="stat-card">
                  <h3>{stat.quiz_title}</h3>
                  <div className="stat-item">
                    <span className="stat-label">Всього спроб:</span>
                    <span className="stat-value">{stat.total_attempts}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Унікальних студентів:</span>
                    <span className="stat-value">{stat.unique_students}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Середній бал:</span>
                    <span className="stat-value">
                      {stat.avg_score ? stat.avg_score.toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Найкращий результат:</span>
                    <span className="stat-value">
                      {stat.max_score ? stat.max_score.toFixed(1) : 0}%
                    </span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Найгірший результат:</span>
                    <span className="stat-value">
                      {stat.min_score ? stat.min_score.toFixed(1) : 0}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentView === "quizzes" && (
          <div className="quizzes-view">
            <h2>Тести зі статистикою</h2>
            <div className="quizzes-grid">
              {quizzes.map((quiz) => (
                <div key={quiz.id} className="quiz-card">
                  <h3>{quiz.title}</h3>
                  <div className="quiz-info">
                    <div className="quiz-stat">
                      <span className="stat-label">Всього питань:</span>
                      <span className="stat-value">{quiz.totalQuestions}</span>
                    </div>
                    <div className="quiz-stat">
                      <span className="stat-label">Час на тест:</span>
                      <span className="stat-value">
                        {quiz.timeLimit
                          ? `${quiz.timeLimit} хв`
                          : "Без обмежень"}
                      </span>
                    </div>
                    <div className="quiz-stat">
                      <span className="stat-label">Макс. спроб:</span>
                      <span className="stat-value">{quiz.maxAttempts}</span>
                    </div>
                    <div className="quiz-stat">
                      <span className="stat-label">Всього спроб:</span>
                      <span className="stat-value">
                        {quiz.stats.total_attempts}
                      </span>
                    </div>
                    <div className="quiz-stat">
                      <span className="stat-label">Унікальних студентів:</span>
                      <span className="stat-value">
                        {quiz.stats.unique_students}
                      </span>
                    </div>
                    <div className="quiz-stat">
                      <span className="stat-label">Середній бал:</span>
                      <span className="stat-value">
                        {quiz.stats.avg_score
                          ? quiz.stats.avg_score.toFixed(1)
                          : 0}
                        %
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedResult && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Деталі результату</h3>
              <button
                className="close-btn"
                onClick={() => setSelectedResult(null)}
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="result-details">
                <div className="detail-item">
                  <strong>Студент:</strong> {selectedResult.name}
                </div>
                <div className="detail-item">
                  <strong>Тест:</strong> {selectedResult.quiz_title}
                </div>
                <div className="detail-item">
                  <strong>Спроб:</strong> {selectedResult.attempts}
                </div>
                <div className="detail-item">
                  <strong>Середній бал:</strong>{" "}
                  {selectedResult.average_score.toFixed(1)}%
                </div>
                <div className="detail-item">
                  <strong>Загальний бал:</strong> {selectedResult.total_score}
                </div>
                <div className="detail-item">
                  <strong>Правильних відповідей:</strong>{" "}
                  {selectedResult.correct_count}
                </div>
                <div className="detail-item">
                  <strong>Дата завершення:</strong>{" "}
                  {formatDate(selectedResult.completed_at)}
                </div>
                <div className="detail-item">
                  <strong>Автозбережено:</strong>{" "}
                  {selectedResult.auto_saved ? "Так" : "Ні"}
                </div>
                <div className="detail-item">
                  <strong>Час вичерпано:</strong>{" "}
                  {selectedResult.time_expired ? "Так" : "Ні"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
