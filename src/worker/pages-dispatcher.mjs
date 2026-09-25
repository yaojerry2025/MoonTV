import moonTv from '@cloudflare/next-on-pages/fetch-handler';
import edgetunnel, { MD5MD5 } from '../../vendor/edgetunnel/worker.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const memoryKvData = new Map();

// This preserves working default subscriptions when a KV binding has not yet
// been configured. Production e_admin changes require a durable KV binding
// named KV and are deliberately not persisted in this fallback.
const memoryKv = {
  async get(key) {
    return memoryKvData.get(key) ?? null;
  },
  async put(key, value) {
    memoryKvData.set(key, String(value));
  },
  async delete(key) {
    memoryKvData.delete(key);
  },
  async list() {
    return { keys: [...memoryKvData.keys()].map((name) => ({ name })), list_complete: true };
  },
};

function configuredUuid(env) {
  const uuid = typeof env.UUID === 'string' ? env.UUID.toLowerCase() : '';
  return UUID_V4.test(uuid) ? uuid : null;
}

function isMoonTvRoute(pathname) {
  return (
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/api' ||
    pathname.startsWith('/api/') ||
    pathname === '/_next' ||
    pathname.startsWith('/_next/') ||
    pathname === '/search' ||
    pathname === '/play' ||
    pathname === '/ranking' ||
    pathname === '/douban'
  );
}

function isEdgetunnelTransport(request, url, uuid) {
  if (isMoonTvRoute(url.pathname)) return false;

  if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') return true;
  if (request.method !== 'POST') return false;
  if ((request.headers.get('content-type') || '').toLowerCase().startsWith('application/grpc')) return true;
  if (!uuid) return false;

  return request.headers.has(uuid.slice(1, 7)) || url.searchParams.has(`_${uuid.slice(25, 31)}`);
}

function asRequest(request, url) {
  return new Request(url.toString(), request);
}

function rewriteEdgetunnelLocation(response) {
  const location = response.headers.get('Location');
  if (!location) return response;

  let replacement = location;
  if (location === '/login') replacement = '/e_login';
  else if (location === '/admin' || location.startsWith('/admin/')) replacement = `/e_${location.slice(1)}`;
  if (replacement === location) return response;

  const headers = new Headers(response.headers);
  headers.set('Location', replacement);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function fetchEdgetunnel(request, env, ctx) {
  return edgetunnel.fetch(request, env.KV ? env : { ...env, KV: memoryKv }, ctx);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const uuid = configuredUuid(env);

    // MoonTV owns all normal pages and every API route, including its WebSocket API.
    if (isMoonTvRoute(url.pathname)) return moonTv.fetch(request, env, ctx);

    if (url.pathname === '/e_login' || url.pathname === '/e_admin' || url.pathname.startsWith('/e_admin/')) {
      url.pathname = url.pathname === '/e_login' ? '/login' : `/admin${url.pathname.slice('/e_admin'.length)}`;
      return rewriteEdgetunnelLocation(await fetchEdgetunnel(asRequest(request, url), env, ctx));
    }

    if (url.pathname === '/version') {
      if (!uuid) return new Response('edgetunnel UUID is not configured', { status: 503 });
      if (!url.searchParams.has('uuid')) url.searchParams.set('uuid', uuid);
      return fetchEdgetunnel(asRequest(request, url), env, ctx);
    }

    // Preserve the requested /<UUID> entrypoint while translating it to the
    // upstream subscription endpoint and keeping the token out of Git.
    if (uuid && url.pathname === `/${uuid}`) {
      url.pathname = '/sub';
      url.searchParams.set('token', await MD5MD5(`${url.host}${uuid}`));
      return fetchEdgetunnel(asRequest(request, url), env, ctx);
    }

    if (url.pathname === '/sub' || url.pathname === '/e_sub' || isEdgetunnelTransport(request, url, uuid)) {
      if (url.pathname === '/e_sub') url.pathname = '/sub';
      return fetchEdgetunnel(asRequest(request, url), env, ctx);
    }

    return moonTv.fetch(request, env, ctx);
  },
};
