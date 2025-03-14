'use server'

import { VIDEO_RESOURCE_CREATED_EVENT } from '@/inngest/events/video-resource'
import { inngest } from '@/inngest/inngest.server'
import { getAbility } from '@/lib/ability'
import { getVideoResource } from '@/lib/video-resource'
import { getServerAuthSession } from '@/server/auth'
import { redis } from '@/server/redis-client'
import { Ratelimit } from '@upstash/ratelimit'

export async function reprocessTranscript({ videoResourceId }: { videoResourceId: string | null }) {
  // template for the url to download the mp4 file from mux
  // https://stream.mux.com/{PLAYBACK_ID}/{MP4_FILE_NAME}?download={FILE_NAME}
  const session = await getServerAuthSession()
  const ability = getAbility({ user: session?.user })

  if (!session || !ability.can('create', 'Content')) {
    throw new Error('Unauthorized')
  }

  const videoResource = await getVideoResource(videoResourceId)

  if (videoResource) {
    await inngest.send({
      name: VIDEO_RESOURCE_CREATED_EVENT,
      data: {
        videoResourceId: videoResource._id,
        originalMediaUrl: `https://stream.mux.com/${videoResource.muxPlaybackId}/low.mp4?download=${videoResource._id}`,
      },
      user: session.user,
    })
  }
}
