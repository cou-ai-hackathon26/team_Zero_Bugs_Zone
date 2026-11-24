import { NextResponse } from 'next/server';
import { db } from '@/db';
import { medicineBrands } from '@/db/schema';
import { and, eq, ilike, or } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.trim() || '';

    if (!query) {
      return NextResponse.json({ medicines: [] });
    }

    const matches = await db
      .select({
        id: medicineBrands.id,
        brandName: medicineBrands.brandName,
        genericName: medicineBrands.genericName,
        manufacturer: medicineBrands.manufacturer,
        form: medicineBrands.form,
        strength: medicineBrands.strength,
        packSize: medicineBrands.packSize,
        priceBdt: medicineBrands.priceBdt,
        dgdaRegNum: medicineBrands.dgdaRegNum,
      })
      .from(medicineBrands)
      .where(
        and(
          eq(medicineBrands.status, 'approved'),
          or(
            ilike(medicineBrands.brandName, `%${query}%`),
            ilike(medicineBrands.genericName, `%${query}%`)
          )
        )
      )
      .limit(30);

    return NextResponse.json({ medicines: matches });
  } catch (error) {
    console.error('[medicines/search] error:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
