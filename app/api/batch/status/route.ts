import { NextRequest, NextResponse } from 'next/server';
import { SarvamAIClient } from 'sarvamai';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json({ error: 'jobId query parameter is required' }, { status: 400 });
    }

    const apiKey = process.env.SARVAM_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Sarvam API Key is not configured' }, { status: 500 });
    }

    const client = new SarvamAIClient({
      apiSubscriptionKey: apiKey,
    });

    // Get status of the batch job
    const statusResponse = await client.speechToTextJob.getStatus(jobId);

    return NextResponse.json(statusResponse);
  } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  catch (error: any) {
    console.error('Batch Status Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get batch job status' },
      { status: 500 }
    );
  }
}
