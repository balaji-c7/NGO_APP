import { NextRequest, NextResponse } from 'next/server';
import { SarvamAIClient } from 'sarvamai';

export async function POST(req: NextRequest) {
  try {
    const { jobId } = await req.json();

    if (!jobId) {
      return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Sarvam API Key is not configured' }, { status: 500 });
    }

    const client = new SarvamAIClient({
      apiSubscriptionKey: apiKey,
    });

    // Start the batch job
    const startResponse = await client.speechToTextJob.start(jobId, {});

    return NextResponse.json({
      status: startResponse.status,
    });

  } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  catch (error: any) {
    console.error('Batch Start Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start batch job' },
      { status: 500 }
    );
  }
}
