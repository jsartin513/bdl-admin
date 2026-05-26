import { del, list, put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

const PREFIX = 'tournament-audio/';

function isMp3File(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith('.mp3') ||
    file.type === 'audio/mpeg' ||
    file.type === 'audio/mp3'
  );
}

function normalizeBlobPathname(pathname: string): string {
  return pathname.startsWith('/') ? pathname.slice(1) : pathname;
}

function isUnderTournamentPrefix(pathname: string): boolean {
  return normalizeBlobPathname(pathname).startsWith(PREFIX);
}

const ALLOWED_BLOB_HOST_SUFFIXES = ['.blob.vercel-storage.com'];

function isVercelBlobHost(hostname: string): boolean {
  return ALLOWED_BLOB_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  );
}

/** Only allow deleting blobs under tournament-audio/. */
function resolveTournamentBlobTarget(
  url?: string,
  pathname?: string
): { url?: string; pathname?: string } {
  if (pathname) {
    if (!isUnderTournamentPrefix(pathname)) {
      throw new Error('pathname must start with tournament-audio/');
    }
    return { pathname: normalizeBlobPathname(pathname) };
  }

  if (!url) {
    throw new Error('url or pathname is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('invalid url');
  }

  if (!isVercelBlobHost(parsed.hostname)) {
    throw new Error('url must be a Vercel Blob storage URL');
  }

  const blobPath = decodeURIComponent(parsed.pathname);
  if (!isUnderTournamentPrefix(blobPath)) {
    throw new Error('url pathname must start with tournament-audio/');
  }

  return { url };
}

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
    if (!isMp3File(file)) {
      return NextResponse.json(
        { error: 'Only MP3 files are supported. Export or convert your clip to .mp3 first.' },
        { status: 400 }
      );
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
      contentType: 'audio/mpeg',
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
    const pathname = body?.pathname as string | undefined;

    const target = resolveTournamentBlobTarget(url, pathname);
    await del(target.url ?? target.pathname!);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete clip';
    const status =
      message.includes('tournament') || message.includes('pathname') || message.includes('invalid')
        ? 400
        : 500;
    console.error('tournament-clips DELETE:', err);
    return NextResponse.json({ error: message }, { status });
  }
}
