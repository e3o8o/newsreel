'use strict';
// Serve the packaged visuals/ directory (harness page, scene bundles, assets)
// over local http for the capture step. file:// cannot host the harness: ES
// module imports and texture fetches both need an http origin.
//
// Zero dependencies: node's http + a tiny extension map. The server binds an
// ephemeral port on 127.0.0.1 and lives only for the duration of a capture run.

const fs = require('fs');
const http = require('http');
const path = require('path');

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.glb': 'model/gltf-binary',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
};

// The visuals root ships inside the newsreel package, next to lib/.
function visualsRoot() {
    return path.join(__dirname, '..', 'visuals');
}

function startVisualsServer() {
    const root = visualsRoot();
    if (!fs.existsSync(path.join(root, 'harness', 'index.html'))) {
        throw new Error(`visuals harness missing at ${root} (broken install?)`);
    }
    const server = http.createServer((req, res) => {
        try {
            const url = new URL(req.url, 'http://x');
            // resolve inside root only; a traversal falls out of root and 404s
            const rel = decodeURIComponent(url.pathname).replace(/^\/+/, '');
            const file = path.join(root, rel);
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                res.writeHead(404).end('not found');
                return;
            }
            res.writeHead(200, {
                'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                'Cache-Control': 'no-store',
            });
            fs.createReadStream(file).pipe(res);
        } catch {
            res.writeHead(500).end();
        }
    });
    return new Promise((resolve, reject) => {
        server.on('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address();
            resolve({
                url: `http://127.0.0.1:${port}`,
                close: () => new Promise((r) => server.close(r)),
            });
        });
    });
}

// Scene URL for one generated shot: harness page + scene name + base64 props.
function sceneUrl(base, shot) {
    const props = Buffer.from(JSON.stringify(shot.props || {}), 'utf8').toString('base64url');
    return `${base}/harness/index.html?scene=${encodeURIComponent(shot.scene)}&props=${props}`;
}

module.exports = { startVisualsServer, sceneUrl, visualsRoot };
