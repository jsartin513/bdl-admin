import { buildSocialKit } from '@/app/lib/publish/social-kit'
import { getPublishPost } from '@/app/lib/publish/mutations'
import { sendNotifyEmail } from '@/app/lib/notify-email'

export async function sendSocialKitReminderEmail(opts: {
  publishPostId: string
  toEmail?: string
  title?: string
}) {
  const post = await getPublishPost(opts.publishPostId)
  if (!post || post.status !== 'published') {
    throw new Error('Publish post is not published')
  }

  const to =
    opts.toEmail?.trim() ||
    process.env.ADMIN_LOGIN_ALERT_TO?.trim() ||
    process.env.CONTACT_EMAIL_FROM?.match(/<([^>]+)>/)?.[1]

  if (!to) {
    console.info(
      JSON.stringify({
        event: 'social_kit_reminder_skipped',
        reason: 'no_recipient',
        publishPostId: opts.publishPostId,
      })
    )
    return
  }

  const kit = buildSocialKit(post)
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '') || ''
  const adminLink = base ? `${base}/publish/${post.id}` : `/publish/${post.id}`

  const subject = `Social kit ready: ${post.title}`
  const text = [
    `Your scheduled publish "${post.title}" is live on the website.`,
    '',
    `Admin: ${adminLink}`,
    `Public: ${kit.publicPageUrl}`,
    '',
    'Instagram caption:',
    kit.instagramCaption,
    '',
    kit.youtubeTitle ? `YouTube title: ${kit.youtubeTitle}` : '',
    kit.youtubeDescription ? `YouTube description:\n${kit.youtubeDescription}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  await sendNotifyEmail({
    to,
    subject,
    text,
  })
}
