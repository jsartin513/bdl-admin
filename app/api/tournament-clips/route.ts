import { del, list, put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

const PREFIX = 'tournament-audio/';

export async function GET() {
  try {
    const { blobs } = await list({ prefix: PREFIX });
    const clips = blobs.map((b) => {
      const path = b.pathname.replace(PREFIX, '');
      const slash = path.indexOf('/');
      const category = slash >= 0 ? path.slice(0, slash) : '';
      const slug = slash >= 0 ? path.slice(slash + 1).replace(/\.mp3$/i, '') : path;
      return {
        url: b.url,
        pathname: b.pathname,
        key: path.replace(/\.mp3$/i, ''),
        category,
        slug,
        uploadedAt: b.uploadedAt,
        size: b.size,
      };
    });
    return NextResponse.json({ clips });
  } catch (err) {
    console.error('tournament-clips GET:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list clips' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const category = formData.get('category')?.toString();
    const slug = formData.get('slug')?.toString();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    if (category !== 'teams' && category !== 'generic') {
      return NextResponse.json({ error: 'category must be teams or generic' }, { status: 400 });
    }
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'invalid slug' }, { status: 400 });
    }

    const pathname = `${PREFIX}${category}/${slug}.mp3`;
    const blob = await put(pathname, file, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      key: `${category}/${slug}`,
      category,
      slug,
    });
  } catch (err) {
    console.error('tournament-clips POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to upload clip' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const url = body?.url as string | undefined;
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 });
    }
    await del(url);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('tournament-clips DELETE:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete clip' },
      { status: 500 }
    );
  }
}
