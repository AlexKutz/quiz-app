const fetch = require("node-fetch");

async function testServer() {
  try {
    console.log("Testing server...");

    // Test quizzes endpoint
    const quizzesResponse = await fetch("http://localhost:3000/quizzes");
    const quizzes = await quizzesResponse.json();
    console.log("Available quizzes:", quizzes);

    if (quizzes.length > 0) {
      const quizId = quizzes[0].id;
      console.log(`\nTesting quiz: ${quizId}`);

      // Test questions endpoint
      const questionsResponse = await fetch(
        `http://localhost:3000/questions/${quizId}`
      );
      const questionsData = await questionsResponse.json();
      console.log("Quiz data:", {
        title: questionsData.quizTitle,
        students: questionsData.students,
        studentsCount: questionsData.students
          ? questionsData.students.length
          : 0,
      });
    }
  } catch (error) {
    console.error("Error testing server:", error);
  }
}

testServer();
