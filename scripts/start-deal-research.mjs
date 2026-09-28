// Isolated research workspace; never opens another demo's chain database.
process.env.ADE_DATA_DIR ??= 'data/private/deal-escrow/research-live-20260929';
process.env.ADE_PORT ??= '3412';
await import('../src/deal-escrow/server.mjs');
