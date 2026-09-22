import { NextRequest, NextResponse } from 'next/server';
import { SarvamAIClient } from 'sarvamai';

export async function POST(req: NextRequest) {
  try {
    const { filename, languageCode = 'hi-IN' } = await req.json();

    if (!filename) {
      return NextResponse.json({ error: 'Filename is required' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Sarvam API Key is not configured' }, { status: 500 });
    }

    const client = new SarvamAIClient({
      apiSubscriptionKey: apiKey,
    });

    // 1. Initialize the batch job
    const initResponse = await client.speechToTextJob.initialise({
      job_parameters: {
        model: 'saaras:v4',
        mode: 'transcribe',
        language_code: languageCode,
      }
    });

    const jobId = initResponse.job_id;

    if (!jobId) {
      throw new Error('Failed to get job_id from Sarvam AI');
    }

    // 2. Get the upload links for the provided filename
    const uploadLinksResponse = await client.speechToTextJob.getUploadLinks({
      job_id: jobId,
      files: [filename],
    });

    const uploadUrl = uploadLinksResponse.upload_urls?.[filename]?.file_url;

    // if (!uploadUrl) {
    //   throw new Error('Failed to generate upload URL');
    // }

    return NextResponse.json({
      jobId,
      uploadUrl,
    });

  } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  catch (error: any) {
    console.error('Batch Init Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initialize batch job' },
      { status: 500 }
    );
  }
}
