import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'data/pilot-workpack');
const commit = '870accc41953dcde885aabeb963d94aabdc0fbc3';
const seed = 'agent-deal-external-pilot-20260929-v1';
const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const pinned = {
  'tatqa_dataset_dev.json': '8da095a819af6db3c14877c6df2d4d29960e41d1a63dd1fa853507bd2a616af5',
  'README.md': '85c398173d771a2531abea5b81f3696914296642da2af78c2c34545715c14d5f',
  'LICENSE': '46e27ffbc49c3fd44a9595c2213f8a5f4319a81b53238e49ce1eec39e7e25662',
};
for (const [name, digest] of Object.entries(pinned)) {
  assert.equal(hash(readFileSync(path.join(base, 'source', name))), digest, `Upstream changed: ${name}`);
}
const data = JSON.parse(readFileSync(path.join(base, 'source/tatqa_dataset_dev.json'), 'utf8'));
const all = data.flatMap(context => context.questions.map(question => ({context, question})));
assert.equal(all.length, 1668);
const seen = new Set();
const selected = [];
// Fixed stratification, hash ordering and unique contexts; no model outcomes used.
for (const type of ['span', 'multi-span', 'count', 'arithmetic']) {
  const ranked = all.filter(x => x.question.answer_type === type)
    .sort((a, b) => hash(`${seed}:${a.question.uid}`).localeCompare(hash(`${seed}:${b.question.uid}`)));
  const group = [];
  for (const entry of ranked) {
    if (seen.has(entry.context.table.uid)) continue;
    seen.add(entry.context.table.uid);
    group.push(entry);
    if (group.length === 3) break;
  }
  assert.equal(group.length, 3);
  selected.push(...group);
}
// Interleave types in participant order. Labels stay in evaluator material only.
const ordered = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11].map(i => selected[i]);
const tasks = ordered.map(({context, question}, i) => ({
  task_id: `EXT-${String(i + 1).padStart(2, '0')}`,
  question: question.question,
  table: context.table.table,
  paragraphs: context.paragraphs.map(p => ({paragraph_id: `P${p.order}`, text: p.text})),
}));
const answers = ordered.map(({context, question}, i) => ({
  task_id: tasks[i].task_id,
  upstream_context_uid: context.table.uid,
  upstream_question_uid: question.uid,
  answer: question.answer,
  answer_type: question.answer_type,
  scale: question.scale,
  derivation: question.derivation,
  answer_from: question.answer_from,
  relevant_paragraphs: question.rel_paragraphs,
  reference_status: 'UPSTREAM_LABEL_NOT_INDEPENDENTLY_HUMAN_REVIEWED',
}));
const taskBytes = json(tasks);
const packId = hash(taskBytes);
const sourceUrl = `https://raw.githubusercontent.com/NExTplusplus/TAT-QA/${commit}/dataset_raw/tatqa_dataset_dev.json`;
const manifest = {
  schema_version: 1, pack_id: packId, created_on: '2026-09-29',
  status: 'MATERIALS_READY_NOT_EVALUATED',
  dataset: 'TAT-QA dev', repository: 'https://github.com/NExTplusplus/TAT-QA',
  commit, source_url: sourceUrl, source_sha256: pinned['tatqa_dataset_dev.json'],
  license: 'CC-BY-4.0 (dataset); repository code LICENSE is separately MIT',
  license_url: 'https://creativecommons.org/licenses/by/4.0/',
  citation_url: 'https://aclanthology.org/2021.acl-long.254/',
  selection: {seed, method: '3 per type; SHA256(seed:question_uid) ascending; unique contexts; fixed type interleave', counts: {span: 3, 'multi-span': 3, count: 3, arithmetic: 3}},
  number_of_tasks: tasks.length,
  limitations: [
    'Public external-authored benchmark; model training contamination is possible; not a private holdout.',
    'Report excerpts and tables, not original PDFs or verified PDF coordinates.',
    'Not donated anonymized customer work, not customer consent, not evidence of escrow demand.',
    'No participant responses or model executions were created by this builder.',
    'Current CAPEX escrow verifier does not support these generic financial QA tasks; no automatic settlement.',
  ],
};
const escapeCell = value => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
const taskPages = tasks.map(t => {
  const width = Math.max(...t.table.map(r => r.length));
  const header = ['행 / 열', ...Array.from({length: width}, (_, i) => `C${i + 1}`)];
  const rows = t.table.map((row, i) => [`R${i + 1}`, ...Array.from({length: width}, (_, j) => row[j] ?? '')]);
  const table = [header, header.map(() => '---'), ...rows].map(r => '| ' + r.map(escapeCell).join(' | ') + ' |').join('\n');
  return `## ${t.task_id}\n\n${t.question}\n\n${table}\n\n${t.paragraphs.map(p => `**${p.paragraph_id}** ${p.text}`).join('\n\n')}\n\n답: __________  단위/배율: __________\n\n근거 셀(R/C) 또는 문단(P): __________\n\n계산식·모호한 점: __________\n`;
}).join('\n');
const attribution = `# 출처 및 이용 표시\n\nTAT-QA: A Question Answering Benchmark on a Hybrid of Tabular and Textual Content in Finance.\nFengbin Zhu, Wenqiang Lei, Youcheng Huang, Chao Wang, Shuo Zhang, Jiancheng Lv, Fuli Feng, Tat-Seng Chua (ACL 2021).\n\n- 논문: https://aclanthology.org/2021.acl-long.254/\n- 원본 저장소: https://github.com/NExTplusplus/TAT-QA\n- 데이터 라이선스: CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/\n- 고정 버전: ${commit}\n- 원본: ${sourceUrl}\n- 변경: dev 집합에서 12개 선택, 작업 ID와 셀 좌표 표시 추가, 문단 ID 변환, 정답/유형/근거 라벨 별도 분리, 표시를 Markdown으로 변환. 원문 질문·표·문단 및 정답 내용은 유지.\n- 원저자와 발행사의 보증·제휴를 의미하지 않습니다.\n\n이 자료는 공개 기업 보고서 발췌입니다. 익명 고객의 기밀 작업이나 독립적으로 감사한 원본 PDF가 아닙니다. 개인 참가자 정보는 포함하지 않았으나 원문에 공개된 조직명 등은 유지합니다.\n`;
const participantReadme = `# 외부 재무 자료 작업지\n\n자료 ID: ${packId}\n\n같은 입력을 읽고 답·단위·근거 셀(R/C) 또는 문단(P)·계산식을 제출합니다. 모르면 abstain으로 답하고 이유를 적습니다. 빈칸을 추측해 채우지 않습니다. 각 작업의 시작/종료 시각, 사용 도구, 재시도, 검수 시간을 따로 기록합니다. 질문은 원문 영어를 유지했습니다. 번역 도구 사용 여부도 기록합니다.\n\n- tasks.md: 사람이 읽는 12개 작업지\n- tasks.json: 시스템에 전달할 동일 질문·표·문단\n- response-template.json: 빈 제출 양식 (복사해서 사용)\n- ATTRIBUTION.md: 출처·라이선스·변경 내용\n\n공개 재무 보고서 발췌에 대한 QA입니다. 앱의 CAPEX 지급/환불 검사를 실행하는 자료가 아닙니다. 학습 데이터에 포함되었을 가능성이 있으며 비공개 평가라고 부르지 않습니다.\n\n운영자는 이 participant 폴더만 참가자/모델에 전달하세요. 평가자 정답은 별도 폴더에 있습니다. 파일 분리는 접근권한 보안 장벽이 아니므로 모델 실행에 저장소 전체 접근권한을 주지 마세요.\n`;
const blank = {
  pack_id: packId, status: 'BLANK_TEMPLATE_NOT_A_RESPONSE', participant_code: null,
  participant_kind: null, consent_to_record: null, method: null,
  tool_or_model_version: null, started_at: null, finished_at: null,
  tasks: tasks.map(t => ({task_id: t.task_id, answer: null, scale: null, evidence: null,
    calculation: null, abstain_reason: null, elapsed_seconds: null, review_seconds: null,
    retries: null, model_calls: null, tokens: null, cost_amount: null, cost_currency: null})),
};
const files = new Map([
  ['participant/tasks.json', taskBytes], ['participant/tasks.md', `# 재무 보고서 작업 12개\n\n[출처·라이선스](ATTRIBUTION.md) · [진행 안내](README.ko.md)\n\n${taskPages}`],
  ['participant/README.ko.md', participantReadme], ['participant/ATTRIBUTION.md', attribution],
  ['participant/response-template.json', json(blank)],
  ['evaluator/reference-answers.json', json(answers)], ['manifest.json', json(manifest)],
]);
// Assert participant input is exactly the allowlisted projection of the pinned source.
for (const t of tasks) {
  assert.deepEqual(Object.keys(t), ['task_id', 'question', 'table', 'paragraphs']);
  for (const p of t.paragraphs) assert.deepEqual(Object.keys(p), ['paragraph_id', 'text']);
}
assert.equal(new Set(tasks.map(t => t.task_id)).size, 12);
assert.equal(new Set(answers.map(a => a.upstream_context_uid)).size, 12);
const verify = process.argv.includes('--verify');
for (const [relative, content] of files) {
  const target = path.join(base, relative);
  if (verify) {
    assert(existsSync(target), `Missing ${relative}`);
    assert.equal(readFileSync(target, 'utf8'), content, `Mismatch ${relative}`);
  } else {
    mkdirSync(path.dirname(target), {recursive: true});
    writeFileSync(target, content);
  }
}
const report = {
  status: 'PASS', checked_at: new Date().toISOString(), pack_id: packId,
  upstream_hashes_verified: Object.keys(pinned).length, external_tasks: tasks.length,
  distinct_contexts: seen.size, participant_input_allowlist: 'PASS',
  deterministic_files: [...files].map(([name, content]) => ({path: name, sha256: hash(content)})),
  actual_participant_responses_created: 0, model_calls: 0,
  meaning: 'Material integrity only; not system accuracy, actual human review or customer validation.',
};
if (verify) writeFileSync(path.join(base, 'verification.json'), json(report));
console.log(json({...report, deterministic_files: report.deterministic_files.length}));
