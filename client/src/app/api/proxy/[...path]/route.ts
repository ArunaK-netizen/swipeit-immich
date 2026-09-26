import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return handleRequest(request, params);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return handleRequest(request, params);
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return handleRequest(request, params);
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    return handleRequest(request, params);
}

async function handleRequest(
    request: NextRequest,
    paramsPromise: Promise<{ path: string[] }>
) {
    const params = await paramsPromise;
    const path = params.path.join('/');

    // Check header first, then cookie, then environment variables
    let immichUrl = request.headers.get('x-immich-url');
    if (!immichUrl) {
        immichUrl = request.cookies.get('immich_server_url')?.value || process.env.NEXT_PUBLIC_IMMICH_SERVER_URL || process.env.IMMICH_SERVER_URL || null;
        if (immichUrl) {
            // Ensure base URL has /api appended if not already present
            let baseUrl = immichUrl.replace(/\/$/, '');
            if (!baseUrl.endsWith('/api')) {
                baseUrl = `${baseUrl}/api`;
            }
            immichUrl = baseUrl;
        }
    }

    // Fix for Node.js IPv6/IPv4 resolution behavior ONLY when hostname is strictly 'localhost' on host OS.
    // Preserves host.docker.internal, container names, and custom domain URLs without replacing them.
    if (immichUrl) {
        try {
            const parsedUrl = new URL(immichUrl);
            const isDocker = process.env.DOCKER_ENV === 'true' || process.env.IS_DOCKER === 'true';
            if (parsedUrl.hostname === 'localhost' && !isDocker) {
                parsedUrl.hostname = '127.0.0.1';
                immichUrl = parsedUrl.toString();
            }
        } catch (e) {
            console.warn('[Proxy] Failed to parse immichUrl:', immichUrl);
        }
    }

    if (!immichUrl) {
        return NextResponse.json(
            { error: 'Missing x-immich-url header or cookie' },
            { status: 400 }
        );
    }

    // specific handling for binary data to avoid corruption is tricky with axios/fetch
    // using fetch is safer for streaming response but we need to handle body carefully.

    const targetUrl = `${immichUrl.replace(/\/$/, '')}/${path}`;
    const searchParams = request.nextUrl.searchParams.toString();
    const finalUrl = searchParams ? `${targetUrl}?${searchParams}` : targetUrl;

    const body = request.body;

    // Headers to forward
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('x-immich-url');

    // Add Authorization if missing and enabled via cookie
    // Add Authorization if missing and enabled via cookie or env
    if (!headers.has('Authorization')) {
        const token = request.cookies.get('immich_access_token')?.value || process.env.NEXT_PUBLIC_IMMICH_ACCESS_TOKEN;
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
            console.log("Added Authorization header from cookie/env");
        } else {
            console.warn("No access token found in headers, cookies, or env");
        }
    }

    console.log(`Proxying request to: ${finalUrl}`);

    try {
        const fetchOptions: RequestInit & { duplex?: string } = {
            method: request.method,
            headers: headers,
            body: ['GET', 'HEAD'].includes(request.method) ? undefined : body,
        };

        if (body && !['GET', 'HEAD'].includes(request.method)) {
            fetchOptions.duplex = 'half';
        }

        const response = await fetch(finalUrl, fetchOptions);

        // Create a new Headers object to avoid modifying the original iterator specific behavior
        const responseHeaders = new Headers(response.headers);

        // Remove framing/encoding headers that likely don't apply after we've processed/streamed the body
        responseHeaders.delete('content-encoding');
        responseHeaders.delete('content-length');
        responseHeaders.delete('transfer-encoding');

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        });

    } catch (error: any) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: 'Proxy failed', details: error.message },
            { status: 500 }
        );
    }
}
