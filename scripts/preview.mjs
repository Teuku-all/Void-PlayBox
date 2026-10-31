// Local frontend preview with a same-origin API proxy. No build step or dependencies.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const frontend = fileURLToPath(new URL('../frontend/', import.meta.url));
const upstream = new URL(process.env.PREVIEW_API_URL || 'https://voidplaybox-backend.vercel.app');
const port = Number(process.env.PREVIEW_PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.webp':'image/webp' };

http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      const headers = { 'Content-Type': req.headers['content-type'] || 'application/json' };
      if (req.headers.authorization) headers.Authorization = req.headers.authorization;
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 5 * 1024 * 1024) { res.writeHead(413); res.end(); return; }
        chunks.push(chunk);
      }
      const response = await fetch(new URL(req.url, upstream), {
        method:req.method, headers, redirect:'error', signal:AbortSignal.timeout(25000),
        body:['GET','HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks)
      });
      res.writeHead(response.status, { 'Content-Type':response.headers.get('content-type') || 'application/json', 'Cache-Control':'no-store' });
      res.end(Buffer.from(await response.arrayBuffer()));
      return;
    }
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = resolve(frontend, '.' + (path === '/' ? '/index.html' : path));
    if (!file.startsWith(resolve(frontend) + sep)) { res.writeHead(403); res.end(); return; }
    let content = await readFile(file);
    if (extname(file) === '.html') {
      content = Buffer.from(content.toString('utf8').replace('<head>', "<head><script>window.PLAYBOX_API_BASE='/api';</script>"));
    }
    res.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    const status = error.code === 'ENOENT' ? 404 : 502;
    res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success:false, message:status === 404 ? 'Halaman tidak ditemukan.' : 'Server belum bisa dihubungi. Coba lagi.' }));
  }
}).listen(port, '127.0.0.1', () => console.log(`Playbox preview: http://127.0.0.1:${port}`));
