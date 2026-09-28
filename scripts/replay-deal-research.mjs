process.env.ADE_EVIDENCE_PORT??='3413';
process.env.ADE_EVIDENCE_INDEX='artifacts/deal-escrow/source-sepolia/latest.json';
await import('../src/deal-escrow/evidence-server.mjs');
