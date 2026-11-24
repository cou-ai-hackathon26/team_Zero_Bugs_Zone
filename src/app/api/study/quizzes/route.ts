import { NextResponse } from 'next/server';
import { db } from '@/db';
import { studentQuizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const quizzes = await db.select().from(studentQuizzes).orderBy(studentQuizzes.createdAt);

    const sanitizedQuizzes = quizzes.map((q) => ({
      id: q.id,
      title: q.title,
      topic: q.topic,
      question: q.question,
      options: q.options,
    }));

    return NextResponse.json({ quizzes: sanitizedQuizzes });
  } catch (error) {
    console.error('Student quizzes fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quizId, selectedAnswer } = body;

    if (!quizId || !selectedAnswer) {
      return NextResponse.json({ error: 'quizId and selectedAnswer are required' }, { status: 400 });
    }

    const [quiz] = await db.select().from(studentQuizzes).where(eq(studentQuizzes.id, quizId));
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const isCorrect = quiz.correctAnswer.trim().toUpperCase() === selectedAnswer.trim().toUpperCase();

    return NextResponse.json({
      isCorrect,
      selectedAnswer,
      correctAnswer: quiz.correctAnswer,
      explanation: quiz.explanation,
    });
  } catch (error) {
    console.error('Student quiz evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
