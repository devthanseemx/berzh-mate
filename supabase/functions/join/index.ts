Deno.serve((req) => {
  const url = new URL(req.url);
  const token = url.pathname.split('/').filter(Boolean).pop() ?? '';
  if (!/^[a-f0-9]{32}$/.test(token)) {
    return new Response('This invite link is not valid.', { status: 400 });
  }

  const appLink = `berzhmate://join/${token}`;
  const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Join a trip · Berzh Mate</title></head>
<body style="font-family:Arial,sans-serif;background:#0B1020;color:#E6EDF7;text-align:center;padding:48px 20px">
  <h2>Join a trip on Berzh Mate</h2>
  <p>Open this link in the app to join and share locations and expenses.</p>
  <p><a href="${appLink}" style="display:inline-block;background:#2DD4BF;color:#0B1020;padding:14px 22px;border-radius:12px;font-weight:bold;text-decoration:none">Open in Berzh Mate</a></p>
  <p style="color:#8B96B0;font-size:13px">Don't have the app yet? Ask the trip owner for it.</p>
  <script>setTimeout(function(){ window.location.href = "${appLink}"; }, 300);</script>
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
});