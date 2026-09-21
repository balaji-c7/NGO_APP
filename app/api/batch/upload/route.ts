import { NextRequest, NextResponse } from 'next/server';

export async function PUT(req: NextRequest) {
  try {
    const uploadUrl = req.headers.get('x-upload-url');
    if (!uploadUrl) {
      return NextResponse.json({ error: 'Missing x-upload-url header' }, { status: 400 });
    }

    // Buffer the request into memory to get a precise Content-Length.
    // Azure Blob Storage rejects Transfer-Encoding: chunked for Put Blob operations.
    const bodyBuffer = await req.arrayBuffer();

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': req.headers.get('Content-Type') || 'application/octet-stream',
        'x-ms-blob-type': 'BlockBlob',
        'Content-Length': bodyBuffer.byteLength.toString(),
      },
      body: bodyBuffer,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Proxy upload failed:', response.status, text);
      return NextResponse.json({ error: `Upload failed with status ${response.status}` }, { status: response.status });
    }

    return new NextResponse('Created', { status: 201 });

  } catch (error: any) {
    console.error('Batch Upload Proxy Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to proxy upload' },
      { status: 500 }
    );
  }
}
