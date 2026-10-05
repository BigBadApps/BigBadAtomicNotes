import { test, before, after } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

let serverProcess: ChildProcess;
const PORT = 3009;

before(async () => {
    // Start the server using node and the built version to be faster and more reliable
    serverProcess = spawn('node', ['dist/server.cjs'], {
        env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production' }
    });

    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
        serverProcess.stdout?.on('data', (data) => {
            if (data.toString().includes('Server running on')) {
                resolve();
            }
        });
        serverProcess.stderr?.on('data', (data) => {
            console.error('Server error:', data.toString());
        });
        serverProcess.on('error', reject);

        // Timeout
        setTimeout(() => reject(new Error('Server start timeout')), 5000);
    });
});

after(() => {
    if (serverProcess) {
        serverProcess.kill();
    }
});

test('SSRF Fix: Invalid format should return 400', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/byok/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            baseUrl: 'not-a-url',
            apiKey: 'test',
            model: 'test'
        })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid Base URL format.');
});

test('SSRF Fix: Invalid protocol (file://) should return 400', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/byok/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            baseUrl: 'file:///etc/passwd',
            apiKey: 'test',
            model: 'test'
        })
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid Base URL protocol. Only HTTP and HTTPS are allowed.');
});
