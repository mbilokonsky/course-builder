import { revalidateTag } from 'next/cache'
import { MUX_SRT_READY_EVENT } from '@/inngest/events/mux-add-srt-to-asset'
import { inngest } from '@/inngest/inngest.server'
import { getVideoResource } from '@/lib/video-resource'
import { sanityMutation } from '@/server/sanity.server'
import { mergeSrtWithScreenshots } from '@/transcript-processing/merge-srt-with-screenshots'
import { NonRetriableError } from 'inngest'

export const generateTranscriptWithScreenshots = inngest.createFunction(
  {
    id: `generate-transcript-with-screenshots`,
    name: 'Generate Transcript with Screenshots',
  },
  {
    event: MUX_SRT_READY_EVENT,
  },
  async ({ event, step }) => {
    const videoResource = await step.run('get the video resource from Sanity', async () => {
      return await getVideoResource(event.data.videoResourceId)
    })

    if (!videoResource) {
      throw new NonRetriableError(`Video resource not found for id (${event.data.videoResourceId})`)
    }

    const { transcriptWithScreenshots } = await step.run('generate transcript with screenshots', async () => {
      if (!videoResource.srt || !videoResource.muxPlaybackId) {
        throw new Error(`Video resource (${event.data.videoResourceId}) does not have an srt or muxPlaybackId`)
      }
      return await mergeSrtWithScreenshots(videoResource.srt, videoResource.muxPlaybackId)
    })

    await step.run('update the video resource in Sanity', async () => {
      await sanityMutation([
        {
          patch: {
            id: videoResource._id,
            set: {
              transcriptWithScreenshots,
            },
          },
        },
      ])

      revalidateTag(videoResource._id)
    })

    return { transcriptWithScreenshots }
  },
)
