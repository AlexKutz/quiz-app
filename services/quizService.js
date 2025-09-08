export class QuizService {
  constructor(db) {
    this.db = db;
  }

  checkTimeLimit(quiz, startTime) {
    const settings = quiz.settings;
    if (!settings.timeLimit) {
      return { expired: false, remaining: null, total: null };
    }

    if (!startTime) {
      console.error("startTime is not provided to checkTimeLimit");
      return { expired: false, remaining: null, total: null };
    }

    const timeLimitMs = settings.timeLimit * 60 * 1000;
    const elapsed = Date.now() - startTime;
    const remaining = Math.max(0, timeLimitMs - elapsed);

    return {
      expired: elapsed >= timeLimitMs,
      remaining: Math.floor(remaining / 1000),
      total: settings.timeLimit * 60,
    };
  }

  getRandomQuestions(allQuestions, count) {
    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, allQuestions.length));
  }

  calculateResults(questions, savedAnswers) {
    let correctCount = 0;
    const results = [];

    for (const question of questions) {
      let isCorrect = false;

      if (question.type === "multiple_choice") {
        const userAnswer = savedAnswers[question.id];
        const correctAnswer = question.answer;
        isCorrect = userAnswer === correctAnswer;
      } else if (question.type === "matching") {
        const userAnswer = savedAnswers[question.id];
        const correctAnswer = question.answer;

        // Для сопоставления считаем вопрос правильным только если все сопоставления верны
        const totalMatches = Object.keys(correctAnswer).length;
        const userCorrectMatches = Object.keys(correctAnswer).filter(
          (leftIndex) =>
            userAnswer && userAnswer[leftIndex] === correctAnswer[leftIndex]
        ).length;

        isCorrect = userCorrectMatches === totalMatches;
      } else if (question.type === "text") {
        const userAnswer = savedAnswers[question.id];
        const correctAnswer = question.answer;

        const normalizedUserAnswer = userAnswer
          ? userAnswer.toString().trim().toLowerCase()
          : "";
        const normalizedCorrectAnswer = correctAnswer
          ? correctAnswer.toString().trim().toLowerCase()
          : "";

        isCorrect = normalizedUserAnswer === normalizedCorrectAnswer;
      }

      if (isCorrect) {
        correctCount++;
      }

      results.push({
        id: question.id,
        question: question.question,
        userAnswer: savedAnswers[question.id],
        correctAnswer: question.answer,
        correct: isCorrect,
      });
    }

    // Простой подсчет: каждый правильный ответ = 100 баллов
    const totalScore = correctCount * 100;
    const averageScore = totalScore / questions.length;

    return {
      results,
      correctCount,
      totalScore,
      averageScore,
    };
  }

  autoSaveTest(sessionId, quiz, studentName) {
    const session = this.db.getSession(studentName, quiz.id);
    if (!session) {
      return false;
    }

    try {
      const timeCheck = this.checkTimeLimit(quiz, session.start_time);
      if (timeCheck.expired) {
        console.log(`Time expired for session: ${sessionId}`);

        const savedAnswers = JSON.parse(session.answers || "{}");
        const sessionQuestions = JSON.parse(session.questions);

        const fullQuestions = sessionQuestions
          .map((sessionQ) => {
            return quiz.questions.find(
              (originalQ) => originalQ.id === sessionQ.id
            );
          })
          .filter((q) => q);

        const results = this.calculateResults(fullQuestions, savedAnswers);

        this.db.saveResult(
          session.student_id,
          quiz.id,
          results.results,
          1,
          results.averageScore,
          results.totalScore,
          results.correctCount,
          true,
          true,
          false
        );

        this.db.deleteSession(sessionId);
        console.log(`Session deleted and test auto-saved: ${sessionId}`);
        return true;
      }
    } catch (error) {
      console.error(`Error auto-saving test for session ${sessionId}:`, error);
    }

    return false;
  }

  checkAllSessions() {
    try {
      const sessions = this.db.getAllSessions();
      console.log(`Checking ${sessions.length} active sessions...`);

      let completedSessions = 0;

      for (const session of sessions) {
        try {
          const quiz = this.db.getQuiz(session.quiz_id);
          if (!quiz) {
            console.log(`Quiz not found for session: ${session.id}`);
            continue;
          }

          const timeCheck = this.checkTimeLimit(quiz, session.start_time);

          if (timeCheck.expired) {
            const wasCompleted = this.autoSaveTest(
              session.id,
              quiz,
              session.name
            );
            if (wasCompleted) {
              completedSessions++;
            }
          }
        } catch (error) {
          console.error(`Error processing session ${session.id}:`, error);
          try {
            this.db.deleteSession(session.id);
            console.log(`Removed corrupted session: ${session.id}`);
          } catch (unlinkError) {
            console.error(
              `Error removing corrupted session ${session.id}:`,
              unlinkError
            );
          }
        }
      }

      if (completedSessions > 0) {
        console.log(`Completed ${completedSessions} expired sessions`);
      }
    } catch (error) {
      console.error("Error checking sessions:", error);
    }
  }
}
