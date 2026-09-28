import React from 'react';

export type SourceDescriptor={id:string;company:string;year:number;page:number;row_label:string;currency:string;unit:string;url:string;sha256:string};
export function describeDeal(deal:any,documents:SourceDescriptor[]){
 const doc=documents.find(d=>d.id===deal.requirements.source_document_id);
 if(doc)return `${doc.company} · ${doc.year} Q1–Q4 · ${doc.row_label}`;
 if(deal.requirements.source_document_id)return `원본 PDF 의뢰 · ${deal.requirements.source_document_id}`;
 if(deal.requirements.reference_dataset_id)return `고정 참조표 의뢰 · ${deal.requirements.reference_dataset_id}`;
 return `CAPEX 데이터 · 최소 ${deal.requirements.minimum_rows}행`;
}

export function SourceContext({deal,evidence,documents}:{deal:any;evidence:any;documents:SourceDescriptor[]}){
 const id=deal.requirements.source_document_id;
 if(!id)return null;
 const doc=documents.find(d=>d.id===id),validation=evidence.validation,source=validation?.source_evidence??evidence.preview?.source_evidence;
 const matches=!source||!doc||source.pdf_sha256===doc.sha256;
 return <section className="source-context" aria-label="이 거래의 원문과 검수 범위">
  <p className="eyebrow">이 거래에 연결된 원문</p><h3>{describeDeal(deal,documents)}</h3>
  <dl><dt>문서 ID</dt><dd>{id}</dd><dt>최종 납품</dt><dd>{deal.requirements.minimum_rows}개 분기값 · 전체 납품 재검수</dd><dt>샘플</dt><dd>{evidence.preview?`${evidence.preview.row_count}행 검사 통과 · 최종 납품을 대체하지 않음`:'한 행 샘플은 별도 추가 조건이 있을 때 필요'}</dd><dt>검수 방식</dt><dd>{validation?.validator_version??'아직 최종 검수 기록 없음'}</dd></dl>
  {doc&&matches&&<p><a href={doc.url+'#page='+doc.page} target="_blank" rel="noreferrer">공식 PDF {doc.page}쪽 열기 ↗</a> · {doc.currency} / {doc.unit==='billion'?'십억 단위':doc.unit}</p>}
  {!doc&&<p className="muted">문서 목록 정보가 없어 원본 링크를 표시하지 않습니다.</p>}
  {!matches&&<p role="alert">현재 문서 목록과 기록된 파일 지문이 다릅니다. 현재 문서를 과거 검수 근거로 표시하지 않습니다.</p>}
  {source&&<details><summary>기록된 원본·검수기 버전</summary><p>PDF 지문 <code>{source.pdf_sha256}</code></p><p>{source.parser} · 사람의 원문 검토 {source.human_review??'확인되지 않음'}</p><p>검수기 <code>{source.reader_sha256}</code></p></details>}
  <p className="muted">허용한 PDF 형식에서 원문 셀·부호·단위와 납품을 대조합니다. 원문 자체의 진실성을 인증하지 않습니다. 추출과 검수가 같은 파서를 사용한다는 한계가 남습니다.</p>
 </section>;
}

const eventLabels:Record<string,string>={MANDATE_CREATED:'사람이 예산·납품 조건 승인',NEGOTIATION_EVIDENCE:'모델 견적 판단 기록',DEAL_ACCEPTED:'고정된 거래 조건 수락',TRANSACTION_BLOCKED:'거래 진행 차단',PREVIEW_VALIDATED:'샘플 검사',ESCROW_FUNDED:'에스크로에 대금 예치',DELIVERY_VALIDATED:'최종 납품 검사',ESCROW_RELEASED:'공급자에게 지급',ESCROW_REFUNDED:'구매자에게 환불',BUYER_REFUND_OBSERVED:'구매자의 직접 환불 확인',MANDATE_REVOKED:'사람이 위임 중지'};
export function EvidenceTimeline({receipt}:{receipt:any}){
 const events=[...receipt.mandate_history,...receipt.events].filter(e=>eventLabels[e.event_type]).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 return <section className="evidence-timeline" aria-label="승인부터 정산까지 저장된 사건 순서"><h3>승인부터 정산까지</h3><p className="muted">저장된 사건 순서입니다. 위임의 현재 상태와 거래 당시 검사를 구분하며, 체인 대조 결과는 별도로 확인합니다.</p><ol>{events.map(e=>{const payload=e.structured_payload;return <li key={e.event_id}><time dateTime={e.timestamp}><span className="event-date">{new Date(e.timestamp).toLocaleDateString('ko-KR')}</span>{new Date(e.timestamp).toLocaleTimeString('en-GB',{hour12:false})}</time><div><strong>{eventLabels[e.event_type]}</strong>{e.event_type==='MANDATE_CREATED'&&<span>예산 {(payload.task_budget_minor/100).toFixed(2)} · 건별 최대 {(payload.max_single_minor/100).toFixed(2)} 테스트 단위</span>}{typeof payload.verified==='boolean'&&<span className={payload.verified?'pass':'fail'}>{payload.row_count}행 · {payload.verified?'검사 통과':'검사 실패'}</span>}{payload.reason&&<span>{payload.reason}</span>}{e.event_type==='MANDATE_REVOKED'&&<span>완료된 지급은 취소되지 않습니다.</span>}</div></li>;})}</ol></section>;
}
