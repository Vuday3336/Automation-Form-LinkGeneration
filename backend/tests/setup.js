// Loaded before any app code in tests: gives tests their own throwaway settings,
// so they never need (or touch) your real .env secrets or database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-jwt-secret-'.padEnd(64, 'x');
process.env.INTEGRATION_SECRET ??= 'test-integration-secret-'.padEnd(64, 'y');
process.env.FIELD_ENCRYPTION_KEY ??= 'test-field-encryption-key-'.padEnd(64, 'z');
process.env.FRONTEND_URL ??= 'http://localhost:5173';
process.env.LINK_BASE_URL ??= 'http://localhost:5173';
