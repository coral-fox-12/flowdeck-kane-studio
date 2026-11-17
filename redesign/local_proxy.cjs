// Tiny local forward proxy: listens unauthenticated on 127.0.0.1:18080 and
// relays to the authenticated egress proxy from env https_proxy.
// Lets Chromium (which mishandles embedded proxy credentials) reach the net.
const http = require('http');
const net = require('net');

const upstream = new URL(process.env.https_proxy || process.env.HTTPS_PROXY);
const auth = 'Basic ' + Buffer.from(decodeURIComponent(upstream.username) + ':' + decodeURIComponent(upstream.password)).toString('base64');

const server = http.createServer((req, res) => {
  // Plain HTTP: forward absolute-form request to upstream proxy.
  const opts = {
    host: upstream.hostname, port: Number(upstream.port),
    method: req.method, path: req.url,
    headers: { ...req.headers, 'Proxy-Authorization': auth, host: req.headers.host },
  };
  const p = http.request(opts, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on('error', e => { res.writeHead(502); res.end('proxy error: ' + e.message); });
  req.pipe(p);
});

server.on('connect', (req, socket, head) => {
  // HTTPS tunnel: CONNECT target to upstream proxy with auth, then pipe.
  const [host, port] = req.url.split(':');
  const up = net.connect(Number(upstream.port), upstream.hostname, () => {
    up.write(`CONNECT ${req.url} HTTP/1.1\r\nHost: ${req.url}\r\nProxy-Authorization: ${auth}\r\nProxy-Connection: keep-alive\r\n\r\n`);
  });
  let done = false;
  up.once('data', chunk => {
    if (done) return;
    const head0 = chunk.toString('utf8');
    if (!head0.startsWith('HTTP/1.1 200') && !head0.startsWith('HTTP/1.0 200')) {
      socket.end('HTTP/1.1 502 Bad Gateway\r\n\r\n');
      up.destroy();
      return;
    }
    done = true;
    socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    if (head && head.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', () => { try { socket.end(); } catch {} });
  socket.on('error', () => up.destroy());
});

server.listen(18080, '127.0.0.1', () => console.log('local proxy up on 127.0.0.1:18080'));
