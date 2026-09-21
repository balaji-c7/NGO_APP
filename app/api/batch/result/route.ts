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

    // 1. Get status to find the output filenames
    const statusResponse = await client.speechToTextJob.getStatus(jobId);
    let outputFiles: string[] = [];

    if (statusResponse.job_details && Array.isArray(statusResponse.job_details)) {
      outputFiles = statusResponse.job_details.flatMap((detail: any) => 
        detail.outputs?.map((out: any) => out.file_name).filter(Boolean) || []
      );
    }

    if (outputFiles.length === 0) {
      // Fallback if not populated, sometimes it's "0.json" for the first file
      outputFiles = ["0.json"];
    }

    // 2. Get the download links for the outputs of the batch job
    const downloadResponse = await client.speechToTextJob.getDownloadLinks({
      job_id: jobId,
      files: outputFiles,
    });

    // Based on uploadLinksResponse format, it might be downloadResponse.download_urls?.[outputFiles[0]]?.file_url
    // or downloadResponse.files?.[0]?.url
    const firstFile = outputFiles[0];
    const downloadUrlsMap = (downloadResponse as any).download_urls || (downloadResponse as any).files;
    
    let downloadUrl = '';
    if (downloadUrlsMap && downloadUrlsMap[firstFile]) {
        downloadUrl = downloadUrlsMap[firstFile].file_url || downloadUrlsMap[firstFile].url;
    } else if (downloadResponse.files && Array.isArray(downloadResponse.files)) {
        downloadUrl = downloadResponse.files[0]?.url;
    }

    if (!downloadUrl) {
      throw new Error('No download URL returned. Make sure the job is Completed.');
    }

    // 3. Fetch the transcript from the presigned URL
    const result = await fetch(downloadUrl);
    
    if (!result.ok) {
      throw new Error(`Failed to download result: ${result.statusText}`);
    }

    const json = await result.json();

    return NextResponse.json(json);

  } /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  catch (error: any) {
    console.error('Batch Result Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get batch job result' },
      { status: 500 }
    );
  }
}
