// Development baseline v2. Its vocabulary was expanded after inspecting the
// authored cases. This is not a held-out result or a general semantic parser.
// No expected labels, delivery_mode, sample values or model outputs are read.
import {resolveSelection} from '../src/deal-escrow/research.ts';import {now} from '../src/deal-escrow/domain.ts';
export function ruleReview(description,year=2025){
 const text=description.normalize('NFKC').toLowerCase().replace(/[–—]/g,'-');
 // Remove only a narrow, explicit negation of undesirable content. An unavailable
 // historical actual is still unavailable; matching an isolated keyword is insufficient.
 const asserted=text.replace(/\b(?:not|no) (?:a |an )?(?:budget|prediction|projections?|forecasts?|estimates?)(?:\s+(?:or|and)\s+(?:a |an )?(?:budget|prediction|projections?|forecasts?|estimates?))*\b/g,'');
 const reasons=[];
 if(/\b(?:unavailable|not available|no actuals|not historical|not realized|do not measure realized|does not measure realized)\b/.test(text))reasons.push('ACTUALS_UNAVAILABLE');
 if(/\b(?:forecast\w*|outlook|guidance|estimat\w*|projecti\w*|prediction\w*|budget|annual total|total investing)\b/.test(asserted))reasons.push('SUBSTITUTE_CONTENT');
 const years=text.match(/\b20\d{2}\b/g)??[];if(years.length&&!years.includes(String(year)))reasons.push('WRONG_YEAR');
 if(!/\b(?:facilit\w*|plant and equipment|plant|equipment)\b/.test(text))reasons.push('METRIC_UNCLEAR');
 if(!/\b(?:realized|historical|actual|recorded payments|cash paid|cash expenditures?|amounts that left|figures transcribed)\b/.test(text))reasons.push('ACTUAL_CONTENT_UNCLEAR');
 const periods=/\bquarter\w*\b|four successive three-month intervals/.test(text)||[/jan(?:uary)?-mar(?:ch)?/,/apr(?:il)?-jun(?:e)?/,/jul(?:y)?-sep(?:tember)?/,/oct(?:ober)?-dec(?:ember)?/].every(pattern=>pattern.test(text));
 if(!periods)reasons.push('QUARTERS_UNCLEAR');return {match:reasons.length===0,reasons};
}
export function strongFixedSelection(m,offers,time=now()){
 const eligible=offers.filter(o=>ruleReview(o.description).match).map(offer=>({offer,proposal:{decision:offer.floor_price_minor<offer.price_minor?'counter':'accept',offer_id:offer.offer_id,counter_price_minor:offer.floor_price_minor<offer.price_minor?offer.floor_price_minor:null,reason:'Deterministic vocabulary and bounded negation rules; lowest eligible posted floor.'}})).filter(r=>resolveSelection(m,offers,r.proposal,time).accepted).sort((a,b)=>a.offer.floor_price_minor-b.offer.floor_price_minor||a.offer.deadline-b.offer.deadline||a.offer.offer_id.localeCompare(b.offer.offer_id));
 return eligible[0]?.proposal??{decision:'reject',offer_id:null,counter_price_minor:null,reason:'No offer passed deterministic content and policy checks.'};
}
