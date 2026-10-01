/**
 * Starts the built Node server behind a small gzip proxy for the Lighthouse runs.
 *
 * The standalone Node server serves HTML, CSS and scripts uncompressed; every supported
 * deployment compresses them (the CDN on Vercel, Netlify and Cloudflare, the reverse proxy in
 * front of Node). Auditing the raw server would therefore score the site as visitors never see
 * it, roughly ten points lower on mobile. The proxy listens on PORT (default 4321), the app on
 * PORT + 1, and the ready line Lighthouse CI waits for is printed only once both answer.
 *
 * Usage: node scripts/lhci-server.mjs   (after `pnpm build:node`)
 */
import { spawn } from 'node:child_process';
import http from 'node:http';
import zlib from 'node:zlib';

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT ?? 4321);
const UPSTREAM_PORT = PORT + 1;
const COMPRESSIBLE =
  /^(text\/|application\/(javascript|json|xml|manifest\+json|rss\+xml|ld\+json)|image\/svg\+xml)/;

const app = spawn(process.execPath, ['./dist/server/entry.mjs'], {
  env: { ...process.env, HOST, PORT: String(UPSTREAM_PORT) },
  // The app's own "Server listening" line must not reach stdout before the proxy is up.
  stdio: ['ignore', 'pipe', 'inherit'],
});
app.stdout.on('data', () => {});
app.on('exit', (code) => {
  console.error(`[lhci-server] app server exited with code ${code}`);
  process.exit(code ?? 1);
});
const stop = () => {
  app.kill('SIGTERM');
};
process.on('exit', stop);
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop();
    process.exit(0);
  });
}

await waitForUpstream(30_000);

const proxy = http.createServer((req, res) => {
  const upstream = http.request(
    { host: HOST, port: UPSTREAM_PORT, method: req.method, path: req.url, headers: req.headers },
    (response) => {
      const headers = { ...response.headers };
      const type = String(headers['content-type'] ?? '');
      const acceptsGzip = /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
      const compress =
        acceptsGzip &&
        COMPRESSIBLE.test(type) &&
        !headers['content-encoding'] &&
        response.statusCode !== 204 &&
        response.statusCode !== 304 &&
        req.method !== 'HEAD';
      if (compress) {
        delete headers['content-length'];
        headers['content-encoding'] = 'gzip';
        headers.vary = headers.vary ? `${headers.vary}, Accept-Encoding` : 'Accept-Encoding';
        res.writeHead(response.statusCode ?? 200, headers);
        response.pipe(zlib.createGzip()).pipe(res);
      } else {
        res.writeHead(response.statusCode ?? 200, headers);
        response.pipe(res);
      }
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Upstream error: ${error.message}`);
  });
  req.pipe(upstream);
});

proxy.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT} (gzip proxy for :${UPSTREAM_PORT})`);
});

/** Polls the app server until it answers, whatever the status code. */
function waitForUpstream(timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get({ host: HOST, port: UPSTREAM_PORT, path: '/' }, (response) => {
        response.resume();
        resolve();
      });
      request.on('error', () => {
        if (Date.now() > deadline) {
          reject(new Error(`[lhci-server] app server did not answer within ${timeoutMs} ms`));
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}
