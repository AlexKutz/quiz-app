export interface User {
  id: string;
  name: string;
  fullName?: string;
  username?: string;
  role: "admin" | "user";
}

export interface Question {
  id: string;
  question: string;
  type: "multiple_choice" | "matching" | "text";
  options?: string[];
  correctAnswer?: number;
  explanation?: string;
  image?: string;
  leftColumn?: string[];
  rightColumn?: string[];
}

export interface Quiz {
  id: string;
  title: string;
  description?: string;
  timeLimit: number;
  maxAttempts: number;
  questions: Question[];
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  timeSpent: number;
  answers: {
    [questionId: string]: number | string | { [leftIndex: string]: string };
  };
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  handleLogin: (user: User) => void;
  handleLogout: () => void;
  getAuthToken: () => string | null;
}

export interface TimerContextType {
  timeRemaining: number;
  timeLimit: number;
  timeExpired: boolean;
}

export interface QuizManagerType {
  name: string;
  questions: Question[];
  results: QuizResult | null;
  isCompleted: boolean;
  loading: boolean;
  maxAttemptsReached: boolean;
  attemptsLeft: number | null;
  quizzes: Quiz[];
  selectedQuiz: string | null;
  quizTitle: string | null;
  timeLimit: number | null;
  timeRemaining: number | null;
  timeExpired: boolean;
  savedAnswers: {
    [questionId: string]: number | string | { [leftIndex: string]: string };
  };
  confettiShown: boolean;
  loadQuestions: () => Promise<void>;
  handleAnswersChange: (answers: {
    [questionId: string]: number | string | { [leftIndex: string]: string };
  }) => void;
  handleSubmit: (answers: {
    [questionId: string]: number | string | { [leftIndex: string]: string };
  }) => Promise<void>;
  resetTest: () => void;
  resetToQuizSelection: () => void;
  selectQuiz: (quizId: string) => void;
  markConfettiShown: () => void;
}

// Типы для компонентов
export interface TestFormProps {
  questions: Question[];
  onSubmit: (answers: {
    [questionId: string]: number | string | { [leftIndex: string]: string };
  }) => Promise<void>;
  loading: boolean;
  quizTitle: string | null;
  onAnswersChange: (answers: {
    [questionId: string]: number | string | { [leftIndex: string]: string };
  }) => void;
  savedAnswers: {
    [questionId: string]: number | string | { [leftIndex: string]: string };
  };
}

export interface ResultsProps {
  results: QuizResult | null;
  name: string;
  onReset: () => void;
  maxAttemptsReached: boolean;
  attemptsLeft: number | null;
  quizTitle: string | null;
  onBackToQuizzes: () => void;
  timeExpired: boolean;
  confettiShown: boolean;
  onMarkConfettiShown: () => void;
}

export interface QuizSelectionProps {
  quizzes: Quiz[];
  onQuizSelect: (quizId: string) => void;
}

export interface WelcomeSectionProps {
  quizTitle: string;
  user: User | null;
  attemptsLeft: number | null;
  timeLimit: number | null;
  loading: boolean;
  onStartTest: () => void;
  onBackToQuizzes: () => void;
}
