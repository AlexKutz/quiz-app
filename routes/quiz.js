import { sendJSON, parseJSON } from "../utils/response.js";
import { authenticateUser } from "../middleware/auth.js";

export function createQuizRoutes(db, quizService, auth) {
  return {
    getQuizzes(request) {
      const user = authenticateUser(request, auth);
      const quizzes = db.getAvailableQuizzes();

      return sendJSON({
        quizzes,
        authenticated: !!user,
      });
    },

    getQuizInfo(request) {
      const url = new URL(request.url);
      const quizId = url.pathname.split("/")[2];
      const quiz = db.getQuiz(quizId);

      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      return sendJSON({
        quizTitle: quiz.title,
        students: quiz.settings.students || [],
        timeLimit: quiz.settings.timeLimit,
        maxAttempts: quiz.settings.maxAttempts,
        totalQuestions: quiz.questions.length,
        randomQuestionsCount: quiz.settings.randomQuestionsCount,
      });
    },

    getQuestions(request) {
      const url = new URL(request.url);
      const quizId = url.pathname.split("/")[2];
      const { newAttempt, studentName } = Object.fromEntries(url.searchParams);

      const quiz = db.getQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      if (!studentName) {
        return sendJSON(
          {
            error: "Необхідно вказати ім'я учня",
            students: quiz.settings.students || [],
          },
          400
        );
      }

      if (!newAttempt) {
        const session = db.getSession(studentName, quizId);

        if (session) {
          const timeCheck = quizService.checkTimeLimit(
            quiz,
            session.start_time
          );
          console.log("Time check for existing session:", {
            studentName,
            startTime: session.start_time,
            timeLimit: quiz.settings.timeLimit,
            timeCheck,
          });

          if (timeCheck.expired) {
            quizService.autoSaveTest(session.id, quiz, studentName);
            return sendJSON({
              timeExpired: true,
              message:
                "Час на проходження тесту вичерпано. Тест автоматично збережено.",
              quizTitle: quiz.title,
            });
          }

          const savedAnswers = JSON.parse(session.answers || "{}");
          const questions = JSON.parse(session.questions);

          return sendJSON({
            completed: false,
            questions: questions,
            totalQuestions: questions.length,
            quizTitle: quiz.title,
            maxAttempts: quiz.settings.maxAttempts,
            timeLimit: quiz.settings.timeLimit,
            startTime: session.start_time,
            timeRemaining: timeCheck.remaining,
            students: quiz.settings.students || [],
            savedAnswers: savedAnswers,
          });
        }
      }

      if (!newAttempt && studentName) {
        const result = db.getResult(studentName, quizId);

        if (result) {
          if (result.attempts >= quiz.settings.maxAttempts) {
            return sendJSON({
              completed: true,
              results: {
                name: result.name,
                results: JSON.parse(result.results),
                attempts: result.attempts,
                completedAt: result.completed_at,
                quizTitle: result.quiz_title,
                quizId: result.quiz_id,
                averageScore: result.average_score,
                totalScore: result.total_score,
                correctCount: result.correct_count,
                autoSaved: result.auto_saved,
                timeExpired: result.time_expired,
                confettiShown: result.confetti_shown || false,
              },
              maxAttemptsReached: true,
              quizTitle: quiz.title,
              students: quiz.settings.students || [],
            });
          }

          return sendJSON({
            completed: true,
            results: {
              name: result.name,
              results: JSON.parse(result.results),
              attempts: result.attempts,
              completedAt: result.completed_at,
              quizTitle: result.quiz_title,
              quizId: result.quiz_id,
              averageScore: result.average_score,
              totalScore: result.total_score,
              correctCount: result.correct_count,
              autoSaved: result.auto_saved,
              timeExpired: result.time_expired,
              confettiShown: result.confetti_shown || false,
            },
            attemptsLeft: quiz.settings.maxAttempts - result.attempts,
            quizTitle: quiz.title,
            students: quiz.settings.students || [],
          });
        }
      }

      const randomQuestions = quizService.getRandomQuestions(
        quiz.questions,
        quiz.settings.randomQuestionsCount
      );

      const questionsData = randomQuestions.map((q) => {
        const questionData = {
          id: q.id,
          question: q.question,
          type: q.type || "text",
        };

        if (q.type === "multiple_choice" && q.options) {
          questionData.options = q.options;
        }

        if (q.type === "matching") {
          questionData.leftColumn = q.leftColumn;
          questionData.rightColumn = q.rightColumn;
        }

        if (q.image) {
          questionData.image = q.image;
        }

        return questionData;
      });

      const { student, startTime } = db.createSession(
        studentName,
        quizId,
        questionsData
      );

      const timeCheck = quizService.checkTimeLimit(quiz, startTime);
      console.log("Time check for new session:", {
        studentName,
        startTime,
        timeLimit: quiz.settings.timeLimit,
        timeCheck,
      });

      return sendJSON({
        completed: false,
        questions: questionsData,
        totalQuestions: randomQuestions.length,
        quizTitle: quiz.title,
        maxAttempts: quiz.settings.maxAttempts,
        timeLimit: quiz.settings.timeLimit
          ? quiz.settings.timeLimit * 60
          : null,
        startTime: startTime,
        timeRemaining: timeCheck.remaining,
        students: quiz.settings.students || [],
        savedAnswers: {},
      });
    },

    saveAnswer(request) {
      const url = new URL(request.url);
      const quizId = url.pathname.split("/")[2];
      const body = parseJSON(request);
      const { studentName, questionId, answer } = body;

      if (!questionId || answer === undefined) {
        return sendJSON({ error: "Некорректные данные" }, 400);
      }

      const session = db.getSession(studentName, quizId);
      if (!session) {
        return sendJSON({ error: "Сессия не найдена" }, 404);
      }

      try {
        const answers = JSON.parse(session.answers || "{}");
        answers[questionId] = answer;

        db.updateSessionAnswers(session.id, answers);

        return sendJSON({ success: true, message: "Ответ сохранен" });
      } catch (error) {
        console.error("Error saving answer:", error);
        return sendJSON({ error: "Ошибка сохранения ответа" }, 500);
      }
    },

    async submitQuiz(request) {
      const url = new URL(request.url);
      const quizId = url.pathname.split("/")[2];
      console.log("Submit quiz request - quizId:", quizId);

      const body = await parseJSON(request);
      console.log("Submit quiz request - body:", body);

      const { name, answers } = body;

      console.log("Submit quiz request - name:", name);
      console.log("Submit quiz request - answers:", answers);

      if (!name || !answers) {
        console.error("Invalid data - name:", name, "answers:", answers);
        return sendJSON({ error: "Некорректные данные" }, 400);
      }

      const quiz = db.getQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      const session = db.getSession(name, quizId);
      let sessionQuestions = null;

      if (session) {
        const timeCheck = quizService.checkTimeLimit(quiz, session.start_time);

        if (timeCheck.expired) {
          quizService.autoSaveTest(session.id, quiz, name);
          return sendJSON(
            {
              error:
                "Час на проходження тесту вичерпано. Тест автоматично збережено.",
              timeExpired: true,
            },
            400
          );
        }

        sessionQuestions = JSON.parse(session.questions);
        db.deleteSession(session.id);
      }

      let student = db.queries.getStudent.get(name, quizId);
      if (!student) {
        db.queries.insertStudent.run(name, quizId);
        student = db.queries.getStudent.get(name, quizId);
      }

      let questionsForCalculation;
      if (sessionQuestions) {
        questionsForCalculation = sessionQuestions
          .map((sessionQ) => {
            return quiz.questions.find(
              (originalQ) => originalQ.id === sessionQ.id
            );
          })
          .filter((q) => q);
      } else {
        questionsForCalculation = quiz.questions;
      }

      const results = quizService.calculateResults(
        questionsForCalculation,
        answers
      );

      const existingResult = db.getResult(name, quizId);

      if (existingResult) {
        db.updateResult(
          student.id,
          quizId,
          results.results,
          existingResult.attempts + 1,
          results.averageScore,
          results.totalScore,
          results.correctCount,
          false,
          false,
          false
        );
      } else {
        db.saveResult(
          student.id,
          quizId,
          results.results,
          1,
          results.averageScore,
          results.totalScore,
          results.correctCount,
          false,
          false,
          false
        );
      }

      const newResult = {
        name,
        results: results.results,
        attempts: existingResult ? existingResult.attempts + 1 : 1,
        completedAt: new Date().toISOString(),
        quizTitle: quiz.title,
        quizId,
        averageScore: results.averageScore,
        totalScore: results.totalScore,
        correctCount: results.correctCount,
        confettiShown: false,
      };

      return sendJSON({
        ...newResult,
        maxAttemptsReached: newResult.attempts >= quiz.settings.maxAttempts,
      });
    },

    markConfettiShown(request) {
      const url = new URL(request.url);
      const quizId = url.pathname.split("/")[2];
      const body = parseJSON(request);
      const { studentName } = body;

      if (!studentName) {
        return sendJSON({ error: "Некорректные данные" }, 400);
      }

      const user = authenticateUser(request, auth);
      if (!user) {
        return sendJSON({ error: "Необхідна авторизація" }, 401);
      }

      const student = db.queries.getStudent.get(studentName, quizId);
      if (!student) {
        return sendJSON({ error: "Студент не найден" }, 404);
      }

      db.markConfettiShown(student.id, quizId);

      return sendJSON({ success: true, message: "Confetti marked as shown" });
    },

    checkTime(request) {
      const url = new URL(request.url);
      const quizId = url.pathname.split("/")[2];
      const { studentName } = Object.fromEntries(url.searchParams);

      const quiz = db.getQuiz(quizId);
      if (!quiz) {
        return sendJSON({ error: "Тест не найден" }, 404);
      }

      const session = db.getSession(studentName, quizId);

      if (session) {
        const timeCheck = quizService.checkTimeLimit(quiz, session.start_time);

        if (timeCheck.expired) {
          quizService.autoSaveTest(session.id, quiz, studentName);
          return sendJSON({
            timeExpired: true,
            message:
              "Час на проходження тесту вичерпано. Тест автоматично збережено.",
          });
        }

        return sendJSON({
          timeExpired: false,
          timeRemaining: timeCheck.remaining,
          timeLimit: quiz.settings.timeLimit * 60,
        });
      }

      return sendJSON({ timeExpired: false });
    },

    checkSessions() {
      quizService.checkAllSessions();
      return sendJSON({ message: "Session check completed" });
    },
  };
}
