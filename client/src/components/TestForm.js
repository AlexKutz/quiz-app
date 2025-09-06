import React, { useState, useEffect } from "react";
import "./TestForm.css";
import MathJaxText from "./MathJaxText";

const TestForm = ({
  questions,
  onSubmit,
  loading,
  timeRemaining,
  timeLimit,
  onAnswersChange,
  savedAnswers = {}, // Додаємо пропс для збережених відповідей
}) => {
  const [answers, setAnswers] = useState(savedAnswers);
  const [rightColumnOrder, setRightColumnOrder] = useState({});
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Синхронізуємо локальний стан з збереженими відповідями
  useEffect(() => {
    setAnswers(savedAnswers);
  }, [savedAnswers]);

  const handleAnswerChange = (questionId, value) => {
    const newAnswers = {
      ...answers,
      [questionId]: value,
    };
    setAnswers(newAnswers);
    if (onAnswersChange) {
      onAnswersChange(newAnswers);
    }
  };

  const handleMatchingAnswerChange = (questionId, leftIndex, rightIndex) => {
    const newAnswers = {
      ...answers,
      [questionId]: {
        ...answers[questionId],
        [leftIndex]: rightIndex,
      },
    };
    setAnswers(newAnswers);
    if (onAnswersChange) {
      onAnswersChange(newAnswers);
    }
  };

  const handleDragStart = (e, originalIndex, questionId) => {
    setDraggedItem({ originalIndex, questionId });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.target.outerHTML);
  };

  const handleDragOver = (e, targetIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(targetIndex);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e, targetIndex, questionId) => {
    e.preventDefault();

    if (draggedItem && draggedItem.questionId === questionId) {
      const question = questions.find((q) => q.id === questionId);
      if (!question) return;

      const currentOrder =
        rightColumnOrder[questionId] ||
        question.rightColumn.map((_, index) => index);

      const draggedIndex = currentOrder.indexOf(draggedItem.originalIndex);
      const newOrder = [...currentOrder];

      // Видаляємо елемент з поточної позиції
      const [movedItem] = newOrder.splice(draggedIndex, 1);
      // Вставляємо на нову позицію
      newOrder.splice(targetIndex, 0, movedItem);

      setRightColumnOrder({
        ...rightColumnOrder,
        [questionId]: newOrder,
      });

      // Оновлюємо відповіді згідно з новим порядком
      const newAnswers = { ...answers };
      if (newAnswers[questionId]) {
        const updatedAnswers = {};
        Object.keys(newAnswers[questionId]).forEach((leftIndex) => {
          const oldRightIndex = newAnswers[questionId][leftIndex];
          const newRightIndex = newOrder.indexOf(parseInt(oldRightIndex));
          updatedAnswers[leftIndex] = newRightIndex.toString();
        });
        newAnswers[questionId] = updatedAnswers;
        setAnswers(newAnswers);
        if (onAnswersChange) {
          onAnswersChange(newAnswers);
        }
      }
    }

    setDraggedItem(null);
    setDragOverIndex(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(answers);
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const renderQuestion = (question, index) => {
    if (question.type === "multiple_choice") {
      return (
        <div key={question.id} className="question-item">
          <label className="question-label">
            <span className="question-number">{index + 1}.</span>
            <MathJaxText className="question-text">
              {question.question}
            </MathJaxText>
          </label>
          <div className="options-container">
            {question.options &&
              question.options.map((option, optionIndex) => (
                <label key={optionIndex} className="option-label">
                  <input
                    type="radio"
                    name={`question_${question.id}`}
                    value={option}
                    checked={answers[question.id] === option}
                    onChange={(e) =>
                      handleAnswerChange(question.id, e.target.value)
                    }
                    className="option-input"
                  />
                  <MathJaxText className="option-text">{option}</MathJaxText>
                </label>
              ))}
          </div>
        </div>
      );
    } else if (question.type === "matching") {
      // Детальна перевірка для matching питань
      if (!question.leftColumn || !question.rightColumn) {
        console.error("Missing columns:", {
          leftColumn: question.leftColumn,
          rightColumn: question.rightColumn,
        });
        return (
          <div key={question.id} className="question-item">
            <label className="question-label">
              <span className="question-number">{index + 1}.</span>
              <MathJaxText className="question-text">
                {question.question}
              </MathJaxText>
            </label>
            <div className="error-message">
              Помилка: відсутні дані для питання на об'єднання
              <br />
              LeftColumn: {question.leftColumn ? "OK" : "MISSING"}
              <br />
              RightColumn: {question.rightColumn ? "OK" : "MISSING"}
            </div>
          </div>
        );
      }

      if (
        !Array.isArray(question.leftColumn) ||
        !Array.isArray(question.rightColumn)
      ) {
        console.error("Columns are not arrays:", {
          leftColumn: typeof question.leftColumn,
          rightColumn: typeof question.rightColumn,
        });
        return (
          <div key={question.id} className="question-item">
            <label className="question-label">
              <span className="question-number">{index + 1}.</span>
              <MathJaxText className="question-text">
                {question.question}
              </MathJaxText>
            </label>
            <div className="error-message">
              Помилка: колонки повинні бути масивами
            </div>
          </div>
        );
      }

      const currentRightOrder =
        rightColumnOrder[question.id] ||
        question.rightColumn.map((_, index) => index);

      return (
        <div key={question.id} className="question-item">
          <label className="question-label">
            <span className="question-number">{index + 1}.</span>
            <MathJaxText className="question-text">
              {question.question}
            </MathJaxText>
          </label>
          <div className="matching-container">
            <div className="matching-instructions">
              <p>
                Перетягніть елементи в правій колонці для встановлення
                правильного порядку
              </p>
            </div>
            <div className="matching-columns">
              <div className="left-column">
                {question.leftColumn.map((item, itemIndex) => (
                  <div key={itemIndex} className="matching-item static-item">
                    <span className="item-label">
                      {String.fromCharCode(65 + itemIndex)}.
                    </span>
                    <MathJaxText>{item}</MathJaxText>
                  </div>
                ))}
              </div>
              <div className="right-column">
                <div className="droppable-area">
                  {currentRightOrder.map((originalIndex, displayIndex) => (
                    <div
                      key={originalIndex}
                      className={`matching-item draggable-item ${
                        dragOverIndex === displayIndex ? "drag-over" : ""
                      }`}
                      draggable
                      onDragStart={(e) =>
                        handleDragStart(e, originalIndex, question.id)
                      }
                      onDragOver={(e) => handleDragOver(e, displayIndex)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, displayIndex, question.id)}
                    >
                      <span className="item-label">{displayIndex + 1}.</span>
                      <MathJaxText>
                        {question.rightColumn[originalIndex]}
                      </MathJaxText>
                      <div className="drag-handle">⋮⋮</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      // Текстове питання (тип за замовчуванням)
      return (
        <div key={question.id} className="question-item">
          <label className="question-label">
            <span className="question-number">{index + 1}.</span>
            <MathJaxText className="question-text">
              {question.question}
            </MathJaxText>
          </label>
          <input
            type="text"
            value={answers[question.id] || ""}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            className="answer-input"
            placeholder="Введите ваш ответ"
          />
        </div>
      );
    }
  };

  return (
    <div className="test-form-container">
      <div className="test-header">
        <h2 className="test-title">Тест</h2>
        {timeLimit && timeRemaining !== null && (
          <div
            className={`timer ${timeRemaining <= 60 ? "timer-warning" : ""}`}
          >
            Залишилось: {formatTime(timeRemaining)}
          </div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="test-form">
        {questions.map((question, index) => renderQuestion(question, index))}

        <button type="submit" className="submit-button" disabled={loading}>
          {loading ? "Відправлення..." : "Відправити відповіді"}
        </button>
      </form>
    </div>
  );
};

export default TestForm;
