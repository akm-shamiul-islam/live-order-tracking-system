import { createServer } from 'node:net';

const USER = 'kitchentodoor-test';
const PASSWORD = 'local-test-password';

export async function createTestSmtpServer() {
  const messages = new Map<string, string[]>();
  const server = createServer((socket) => {
    let input = '';
    let message = '';
    let receivingMessage = false;
    let authUser = '';
    let authStep: 'username' | 'password' | undefined;
    socket.write('220 localhost KitchenToDoor test SMTP\r\n');
    socket.on('data', (chunk: Buffer) => {
      input += chunk.toString('utf8');
      while (true) {
        if (receivingMessage) {
          const end = input.indexOf('\r\n.\r\n');
          if (end < 0) return;
          message += input.slice(0, end + 2);
          input = input.slice(end + 5);
          receivingMessage = false;
          const email = message
            .match(/^To:\s*(?:[^<\r\n]*<)?([^>\r\n]+)>?/im)?.[1]
            ?.trim()
            .toLowerCase();
          const textStart = message.search(/^Content-Type:\s*text\/plain\b/im);
          const textPart = textStart < 0 ? '' : message.slice(textStart);
          const headerEnd = textPart.indexOf('\r\n\r\n');
          const encodedTextBody =
            headerEnd < 0 ? '' : textPart.slice(headerEnd + 4).split(/\r\n--[^\r\n]+/, 1)[0] || '';
          const textBody = encodedTextBody
            .replace(/=\r?\n/g, '')
            .replace(/=([\da-f]{2})/gi, (_match, byte: string) =>
              String.fromCharCode(Number.parseInt(byte, 16)),
            );
          const code =
            message.match(/letter-spacing:9px[^>]*>(\d{6})<\/div>/i)?.[1] ||
            textBody.match(/:\s*(\d{6})(?:\r?\n|$)/)?.[1];
          if (email && code) messages.set(email, [...(messages.get(email) || []), code]);
          message = '';
          socket.write('250 2.0.0 queued\r\n');
          continue;
        }
        const lineEnd = input.indexOf('\r\n');
        if (lineEnd < 0) return;
        const line = input.slice(0, lineEnd);
        input = input.slice(lineEnd + 2);
        if (authStep === 'username') {
          authUser = Buffer.from(line, 'base64').toString('utf8');
          authStep = 'password';
          socket.write('334 UGFzc3dvcmQ6\r\n');
        } else if (authStep === 'password') {
          const password = Buffer.from(line, 'base64').toString('utf8');
          authStep = undefined;
          socket.write(
            authUser === USER && password === PASSWORD
              ? '235 2.7.0 authenticated\r\n'
              : '535 5.7.8 authentication failed\r\n',
          );
        } else if (/^EHLO\b/i.test(line)) {
          socket.write('250-localhost\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 10485760\r\n');
        } else if (/^HELO\b/i.test(line)) {
          socket.write('250 localhost\r\n');
        } else if (/^AUTH\s+PLAIN\s+/i.test(line)) {
          const credentials = Buffer.from(line.replace(/^AUTH\s+PLAIN\s+/i, ''), 'base64')
            .toString('utf8')
            .split('\0');
          socket.write(
            credentials.at(-2) === USER && credentials.at(-1) === PASSWORD
              ? '235 2.7.0 authenticated\r\n'
              : '535 5.7.8 authentication failed\r\n',
          );
        } else if (/^AUTH\s+PLAIN\s*$/i.test(line)) {
          socket.write('334 \r\n');
        } else if (/^AUTH\s+LOGIN/i.test(line)) {
          authStep = 'username';
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (/^DATA\b/i.test(line)) {
          receivingMessage = true;
          socket.write('354 end with <CRLF>.<CRLF>\r\n');
        } else if (/^QUIT\b/i.test(line)) {
          socket.write('221 2.0.0 goodbye\r\n');
          socket.end();
        } else if (/^(MAIL FROM|RCPT TO|RSET|NOOP)\b/i.test(line)) {
          socket.write('250 2.0.0 ok\r\n');
        } else {
          socket.write('500 5.5.2 unsupported command\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('No isolated SMTP port was assigned.');

  async function takeOtp(email: string, timeoutMs = 10_000): Promise<string> {
    const deadline = Date.now() + timeoutMs;
    const key = email.trim().toLowerCase();
    while (Date.now() < deadline) {
      const queued = messages.get(key);
      if (queued?.length) {
        const [code, ...remaining] = queued;
        if (remaining.length) messages.set(key, remaining);
        else messages.delete(key);
        return code!;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`No OTP email was captured for ${key}.`);
  }

  async function close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }

  return {
    host: '127.0.0.1',
    port: address.port,
    user: USER,
    password: PASSWORD,
    from: 'mailer@example.test',
    takeOtp,
    close,
  };
}
