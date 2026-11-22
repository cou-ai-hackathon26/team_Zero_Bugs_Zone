import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { z } from 'zod';
import { boundedJson } from '@/lib/api-input';
import OpenAI from 'openai';

const synthSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  locale: z.enum(['bn', 'en']).default('bn'),
  rate: z.number().min(0.8).max(1.2).default(1.0),
  gender: z.enum(['male', 'female']).default('female'),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await boundedJson(request);
    const parsed = synthSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid synthesis parameters' }, { status: 400 });
    }

    const { text, gender, rate } = parsed.data;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      // In local or unconfigured mode, return 400 so client falls back to browser synthesis
      return NextResponse.json(
        { error: 'OpenAI API key not configured; use browser speech synthesis' },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const voiceChoice = gender === 'female' ? 'nova' : 'onyx';

    const response = await openai.audio.speech.create({
      model: 'tts-1',
      voice: voiceChoice,
      input: text,
      speed: rate,
    });

    const buffer = Buffer.from(await response.arrayBuffer());

    return new Response(buffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err) {
    console.error('[Voice Synthesize Error]:', err);
    return NextResponse.json({ error: 'Speech synthesis failed' }, { status: 500 });
  }
}
