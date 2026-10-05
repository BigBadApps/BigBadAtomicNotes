import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseJwt } from '../src/GoogleAuth';

describe('parseJwt', () => {
    test('correctly decodes a valid JWT', () => {
        const payload = { sub: '1234567890', name: 'John Doe', iat: 1516239022 };
        const encodedPayload = btoa(JSON.stringify(payload));
        const token = `header.${encodedPayload}.signature`;

        const decoded = parseJwt(token);
        assert.deepStrictEqual(decoded, payload);
    });

    test('returns null for an invalid JWT', () => {
        const originalConsoleError = console.error;
        console.error = () => {}; // Suppress error for this test
        try {
            const token = 'invalid.token';
            const decoded = parseJwt(token);
            assert.strictEqual(decoded, null);
        } finally {
            console.error = originalConsoleError;
        }
    });

    test('returns null for malformed token format', () => {
        const originalConsoleError = console.error;
        console.error = () => {}; // Suppress error for this test
        try {
            const token = 'just_one_part';
            const decoded = parseJwt(token);
            assert.strictEqual(decoded, null);
        } finally {
            console.error = originalConsoleError;
        }
    });

    test('handles url-safe base64 characters correctly (- and _)', () => {
        const payload = { special: "a+/b" };
        const base64Url = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
        const token = `header.${base64Url}.signature`;

        const decoded = parseJwt(token);
        assert.deepStrictEqual(decoded, payload);
    });

    test('handles unicode characters correctly', () => {
        const payload = { name: 'Jöhn Dôe 👨‍💻' };
        const base64Url = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
        const token = `header.${base64Url}.signature`;

        const decoded = parseJwt(token);
        assert.deepStrictEqual(decoded, payload);
    });
});
