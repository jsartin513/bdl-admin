#!/usr/bin/env node
/**
 * Video Tools merge worker.
 *
 * Polls bdl-admin for queued upload sets, downloads clips from Vercel Blob,
 * concatenates with ffmpeg (-c copy) in GoPro-aware order, uploads the
 * untrimmed result, and reports complete/fail.
 *
 * Env:
 *   VIDEO_TOOLS_API_BASE   e.g. https://admin.bostondodgeballleague.com
 *   VIDEO_WORKER_SECRET    shared secret (Bearer)
 *   BLOB_READ_WRITE_TOKEN  Vercel Blob RW token (for put of merged output)
 *   POLL_INTERVAL_MS       optional, default 15000
 *   WORK_DIR               optional temp dir, default os.tmpdir()/video-merge-worker
 *
 * Requires: ffmpeg, ffprobe on PATH.
 */

import { createWriteStream, promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const API_BASE = (process.env.VIDEO_TOOLS_API_BASE || '').replace(/\/$/, '')
const SECRET = process.env.VIDEO_WORKER_SECRET || ''
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || ''
const POLL_MS = Number(process.env.POLL_INTERVAL_MS || 15000)
const WORK_ROOT =
  process.env.WORK_DIR || path.join(tmpdir(), 'video-merge-worker')

if (!API_BASE) {
  console.error('VIDEO_TOOLS_API_BASE is required')
  process.exit(1)
}
if (!SECRET) {
  console.error('VIDEO_WORKER_SECRET is required')
  process.exit(1)
}
if (!BLOB_TOKEN) {
  console.error('BLOB_READ_WRITE_TOKEN is required')
  process.exit(1)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function api(pathname, options = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${SECRET}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `API ${pathname} failed (${res.status})`)
  }
  return data
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      ...opts,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => {
      stdout += d.toString()
    })
    child.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else {
        reject(
          new Error(
            `${cmd} exited ${code}: ${stderr.slice(-2000) || stdout.slice(-2000)}`
          )
        )
      }
    })
  })
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed ${res.status} for ${url}`)
  }
  if (!res.body) throw new Error('Empty download body')
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath))
}

async function probeStream(filePath) {
  const { stdout } = await run('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=codec_name,width,height,r_frame_rate,avg_frame_rate,time_base',
    '-of',
    'json',
    filePath,
  ])
  const parsed = JSON.parse(stdout)
  const stream = parsed.streams?.[0]
  if (!stream) throw new Error(`No video stream in ${filePath}`)
  return {
    codec: stream.codec_name,
    width: stream.width,
    height: stream.height,
    rFrameRate: stream.r_frame_rate,
    timeBase: stream.time_base,
  }
}

function assertCompatible(probes, filenames) {
  const first = probes[0]
  for (let i = 1; i < probes.length; i++) {
    const p = probes[i]
    if (
      p.codec !== first.codec ||
      p.width !== first.width ||
      p.height !== first.height
    ) {
      throw new Error(
        `Incompatible clips for stream-copy concat: ` +
          `${filenames[0]} (${first.codec} ${first.width}x${first.height}) vs ` +
          `${filenames[i]} (${p.codec} ${p.width}x${p.height}). ` +
          `Split into separate merges or re-encode.`
      )
    }
  }
}

async function uploadMerged(localPath, pathname) {
  const { put } = await import('@vercel/blob')
  const { createReadStream } = await import('node:fs')
  const blob = await put(pathname, createReadStream(localPath), {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'video/mp4',
    multipart: true,
    token: BLOB_TOKEN,
  })
  return blob
}

async function processJob(job) {
  const { set, clips, outputFilename, claimToken } = job
  if (!claimToken) {
    throw new Error('Job missing claimToken')
  }
  console.log(
    `[job ${set.id}] ${set.eventName} · ${set.label} — ${clips.length} clips → ${outputFilename}`
  )

  if (!clips.length) {
    throw new Error('Job has no clips')
  }

  const workDir = path.join(WORK_ROOT, set.id)
  await fs.mkdir(workDir, { recursive: true })

  const localFiles = []
  try {
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i]
      const safe = `${String(i).padStart(4, '0')}_${path.basename(clip.originalFilename)}`
      const dest = path.join(workDir, safe)
      console.log(`[job ${set.id}] download ${clip.originalFilename}`)
      await downloadToFile(clip.blobUrl, dest)
      localFiles.push({ path: dest, name: clip.originalFilename })
    }

    console.log(`[job ${set.id}] probing compatibility`)
    const probes = []
    for (const f of localFiles) {
      probes.push(await probeStream(f.path))
    }
    assertCompatible(
      probes,
      localFiles.map((f) => f.name)
    )

    const listPath = path.join(workDir, 'concat_list.txt')
    const listBody = localFiles
      .map((f) => `file '${f.path.replace(/'/g, `'\\''`)}'`)
      .join('\n')
    await fs.writeFile(listPath, listBody, 'utf8')

    const outPath = path.join(workDir, outputFilename)
    console.log(`[job ${set.id}] ffmpeg concat`)
    await run('ffmpeg', [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listPath,
      '-c',
      'copy',
      outPath,
    ])

    const mergedPathname = `video-tools/${set.id}/merged/${outputFilename}`
    console.log(`[job ${set.id}] upload ${mergedPathname}`)
    const blob = await uploadMerged(outPath, mergedPathname)

    await api('/api/video-tools/worker/complete', {
      method: 'POST',
      body: JSON.stringify({
        setId: set.id,
        claimToken,
        mergedBlobUrl: blob.url,
        mergedBlobPathname: blob.pathname,
        outputFilename,
      }),
    })
    console.log(`[job ${set.id}] complete`)
  } finally {
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function tick() {
  const data = await api('/api/video-tools/worker/claim', { method: 'POST' })
  const job = data.job
  if (!job) return false

  try {
    await processJob(job)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[job ${job.set.id}] failed:`, message)
    try {
      await api('/api/video-tools/worker/fail', {
        method: 'POST',
        body: JSON.stringify({
          setId: job.set.id,
          claimToken: job.claimToken,
          errorMessage: message,
        }),
      })
    } catch (failErr) {
      console.error('Failed to report failure:', failErr)
    }
  }
  return true
}

async function main() {
  await run('ffmpeg', ['-version']).catch(() => {
    console.error('ffmpeg not found on PATH')
    process.exit(1)
  })
  await run('ffprobe', ['-version']).catch(() => {
    console.error('ffprobe not found on PATH')
    process.exit(1)
  })

  console.log(`Video merge worker polling ${API_BASE} every ${POLL_MS}ms`)
  await fs.mkdir(WORK_ROOT, { recursive: true })

  for (;;) {
    try {
      const worked = await tick()
      if (!worked) await sleep(POLL_MS)
    } catch (err) {
      console.error('Poll error:', err)
      await sleep(POLL_MS)
    }
  }
}

main()
