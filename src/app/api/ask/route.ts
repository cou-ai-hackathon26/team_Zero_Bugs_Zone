import { boundedJson, rateLimit } from '@/lib/api-input';
import { getCurrentUser } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { searchLibraryText } from '@/lib/retrieval';
import { libraryExcerpts } from '@/lib/library-excerpts';
import bn from '../../../../messages/bn.json';
import en from '../../../../messages/en.json';

const requestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  locale: z.enum(['bn', 'en']).default('bn'),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const limited = rateLimit(`ask:${user.id}`, 20);
    if (limited) return limited;
    const input = requestSchema.safeParse(await boundedJson(request, 4096));
    if (!input.success) return NextResponse.json({ error: 'Invalid library question' }, { status: 400 });

    const { question, locale } = input.data;
    const citations = libraryExcerpts(await searchLibraryText(question, 4));
    if (citations.length === 0) {
      return NextResponse.json({ found: false, status: 'insufficient_evidence', answer: null, citations: [] });
    }
    return NextResponse.json({ found: true, answer: (locale === 'bn' ? bn : en).ask.excerpts, citations });
  } catch {
    return NextResponse.json({ error: 'Library query failed' }, { status: 500 });
  }
}
