import tls from 'tls';

function readLine(socket, buffer) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      buffer.value += chunk.toString('utf8');
      const lines = buffer.value.split(/\r?\n/);
      const last = lines[lines.length - 2] || '';
      if (/^\d{3}\s/.test(last)) {
        socket.off('data', onData);
        socket.off('error', reject);
        const message = buffer.value;
        buffer.value = '';
        resolve(message);
      }
    };
    socket.on('data', onData);
    socket.once('error', reject);
  });
}

async function command(socket, buffer, text, expectedPrefix) {
  socket.write(`${text}\r\n`);
  const response = await readLine(socket, buffer);
  if (!response.startsWith(expectedPrefix)) {
    throw new Error(`SMTP command failed: ${response.split(/\r?\n/)[0]}`);
  }
  return response;
}

function encodeHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').trim();
}

export async function sendMail({ to, subject, text }) {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.SMTP_FROM || user;

  if (!user || !pass || !from) {
    console.warn(`Email not sent to ${to}: SMTP_USER, SMTP_PASS, or SMTP_FROM is missing.`);
    return { sent: false, skipped: true };
  }

  const socket = tls.connect({ host, port, servername: host });
  const buffer = { value: '' };

  await new Promise((resolve, reject) => {
    socket.once('secureConnect', resolve);
    socket.once('error', reject);
  });

  try {
    const greeting = await readLine(socket, buffer);
    if (!greeting.startsWith('220')) throw new Error(`SMTP greeting failed: ${greeting}`);

    await command(socket, buffer, 'EHLO medijourney.local', '250');
    await command(socket, buffer, 'AUTH LOGIN', '334');
    await command(socket, buffer, Buffer.from(user).toString('base64'), '334');
    await command(socket, buffer, Buffer.from(pass).toString('base64'), '235');
    await command(socket, buffer, `MAIL FROM:<${from}>`, '250');
    await command(socket, buffer, `RCPT TO:<${to}>`, '250');
    await command(socket, buffer, 'DATA', '354');

    const body = [
      `From: ${encodeHeader(process.env.SMTP_FROM_NAME || 'Medijourney')} <${from}>`,
      `To: <${to}>`,
      `Subject: ${encodeHeader(subject)}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=UTF-8',
      '',
      text,
      '.',
    ].join('\r\n');
    socket.write(`${body}\r\n`);
    const queued = await readLine(socket, buffer);
    if (!queued.startsWith('250')) throw new Error(`SMTP queue failed: ${queued}`);
    await command(socket, buffer, 'QUIT', '221');
    return { sent: true };
  } finally {
    socket.end();
  }
}
