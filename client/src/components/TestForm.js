import React, { useState, useEffect, memo, useCallback } from "react";
import "./TestForm.css";
import MathJaxText from "./MathJaxText";
import { useTimer } from "../contexts/TimerContext";

// Окремий компонент для таймера, щоб уникнути перерендеру всього TestForm
const Timer = memo(() => {
  const { timeRemaining, timeLimit } = useTimer();

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  if (!timeLimit || timeRemaining === null) {
    return null;
  }

  return (
    <div className={`timer ${timeRemaining <= 60 ? "timer-warning" : ""}`}>
      Залишилось: {formatTime(timeRemaining)}
    </div>
  );
});

// Окремий компонент для зображення з мемоізацією
const QuestionImage = memo(({ imageUrl, alt = "Зображення до питання" }) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);

  const handleImageLoad = useCallback(() => {
    setImageLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoading(false);
  }, []);

  if (imageError) {
    return (
      <div className="image-error">
        <p>Не вдалося завантажити зображення</p>
        <p className="image-url">URL: {imageUrl}</p>
      </div>
    );
  }

  return (
    <div className="question-image-container">
      {imageLoading && (
        <div className="image-loading">
          <p>Завантаження зображення...</p>
        </div>
      )}
      <img
        src={imageUrl}
        alt={alt}
        className="question-image"
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{ display: imageLoading ? "none" : "block" }}
      />
    </div>
  );
});

// Окремий компонент для питання з мемоізацією
const QuestionItem = memo(
  ({
    question,
    index,
    answers,
    onAnswerChange,
    rightColumnOrder,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    draggedItem,
    dragOverIndex,
  }) => {
    const handleAnswerChange = useCallback(
      (questionId, value) => {
        onAnswerChange(questionId, value);
      },
      [onAnswerChange]
    );

    if (question.type === "multiple_choice") {
      return (
        <div className="question-item">
          <label className="question-label">
            <span className="question-number">{index + 1}.</span>
            <MathJaxText className="question-text">
              {question.question}
            </MathJaxText>
          </label>

          {question.image && (
            <QuestionImage
              imageUrl={question.image}
              alt={`Зображення до питання ${index + 1}`}
            />
          )}

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
      if (!question.leftColumn || !question.rightColumn) {
        return (
          <div className="question-item">
            <label className="question-label">
              <span className="question-number">{index + 1}.</span>
              <MathJaxText className="question-text">
                {question.question}
              </MathJaxText>
            </label>

            {question.image && (
              <QuestionImage
                imageUrl={question.image}
                alt={`Зображення до питання ${index + 1}`}
              />
            )}

            <div className="error-message">
              Помилка: відсутні дані для питання на об'єднання
            </div>
          </div>
        );
      }

      if (
        !Array.isArray(question.leftColumn) ||
        !Array.isArray(question.rightColumn)
      ) {
        return (
          <div className="question-item">
            <label className="question-label">
              <span className="question-number">{index + 1}.</span>
              <MathJaxText className="question-text">
                {question.question}
              </MathJaxText>
            </label>

            {question.image && (
              <QuestionImage
                imageUrl={question.image}
                alt={`Зображення до питання ${index + 1}`}
              />
            )}

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
        <div className="question-item">
          <label className="question-label">
            <span className="question-number">{index + 1}.</span>
            <MathJaxText className="question-text">
              {question.question}
            </MathJaxText>
          </label>

          {question.image && (
            <QuestionImage
              imageUrl={question.image}
              alt={`Зображення до питання ${index + 1}`}
            />
          )}

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
                        onDragStart(e, originalIndex, question.id)
                      }
                      onDragOver={(e) => onDragOver(e, displayIndex)}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDrop(e, displayIndex, question.id)}
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
      // Текстове питання
      return (
        <div className="question-item">
          <label className="question-label">
            <span className="question-number">{index + 1}.</span>
            <MathJaxText className="question-text">
              {question.question}
            </MathJaxText>
          </label>

          {question.image && (
            <QuestionImage
              imageUrl={question.image}
              alt={`Зображення до питання ${index + 1}`}
            />
          )}

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
  }
);

const TestForm = memo(
  ({ questions, onSubmit, loading, onAnswersChange, savedAnswers = {} }) => {
    const [answers, setAnswers] = useState(savedAnswers);
    const [rightColumnOrder, setRightColumnOrder] = useState({});
    const [draggedItem, setDraggedItem] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);

    // Синхронізуємо локальний стан з збереженими відповідями
    useEffect(() => {
      if (savedAnswers && Object.keys(savedAnswers).length > 0) {
        setAnswers(savedAnswers);
      }
    }, [savedAnswers]);

    const handleAnswerChange = useCallback(
      (questionId, value) => {
        const newAnswers = {
          ...answers,
          [questionId]: value,
        };
        setAnswers(newAnswers);
        if (onAnswersChange) {
          onAnswersChange(newAnswers);
        }
      },
      [answers, onAnswersChange]
    );

    const handleDragStart = useCallback((e, originalIndex, questionId) => {
      setDraggedItem({ originalIndex, questionId });
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/html", e.target.outerHTML);
    }, []);

    const handleDragOver = useCallback((e, targetIndex) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverIndex(targetIndex);
    }, []);

    const handleDragLeave = useCallback(() => {
      setDragOverIndex(null);
    }, []);

    const handleDrop = useCallback(
      (e, targetIndex, questionId) => {
        e.preventDefault();

        if (draggedItem && draggedItem.questionId === questionId) {
          const question = questions.find((q) => q.id === questionId);
          if (!question) return;

          const currentOrder =
            rightColumnOrder[questionId] ||
            question.rightColumn.map((_, index) => index);

          const draggedIndex = currentOrder.indexOf(draggedItem.originalIndex);
          const newOrder = [...currentOrder];

          const [movedItem] = newOrder.splice(draggedIndex, 1);
          newOrder.splice(targetIndex, 0, movedItem);

          setRightColumnOrder({
            ...rightColumnOrder,
            [questionId]: newOrder,
          });

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
      },
      [draggedItem, questions, rightColumnOrder, answers, onAnswersChange]
    );

    const handleSubmit = useCallback(
      (e) => {
        e.preventDefault();
        onSubmit(answers);
      },
      [onSubmit, answers]
    );

    return (
      <div className="test-form-container">
        <div className="test-header">
          <h2 className="test-title">Тест</h2>
          <Timer />
        </div>
        <form onSubmit={handleSubmit} className="test-form">
          {questions.map((question, index) => (
            <QuestionItem
              key={question.id}
              question={question}
              index={index}
              answers={answers}
              onAnswerChange={handleAnswerChange}
              rightColumnOrder={rightColumnOrder}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              draggedItem={draggedItem}
              dragOverIndex={dragOverIndex}
            />
          ))}

          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? "Відправлення..." : "Відправити відповіді"}
          </button>
        </form>
      </div>
    );
  }
);

TestForm.displayName = "TestForm";

export default TestForm;
