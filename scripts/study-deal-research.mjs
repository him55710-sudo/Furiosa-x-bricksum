import path from 'node:path';
import {loadReplay} from '../src/deal-escrow/replay-evidence.mjs';
import {captureStudyBuild,createStudySession} from '../src/deal-escrow/study-session.mjs';
const replay=await loadReplay('artifacts/deal-escrow/source-sepolia/latest.json');
const session=createStudySession({replay,files:captureStudyBuild(path.resolve('dist-deal-escrow-public')),directory:path.resolve(process.env.ADE_STUDY_DIR??'data/private/deal-escrow/source-study')});
const server=session.app.listen(Number(process.env.ADE_STUDY_PORT??3414),'127.0.0.1',()=>console.log(`Local participant study: http://127.0.0.1:${server.address().port}/?study=1 (version ${session.version.slice(0,12)})`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
