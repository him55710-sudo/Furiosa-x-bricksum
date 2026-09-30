# Product languages

Accord Lock supports English, Korean, and Simplified Chinese. Use the language selector in the header on the homepage, purchase conversation, Presentation, Detailed Deal Room, or Proof page. English remains the initial default; the selected language is saved in browser storage under `accord-language`.

## Coverage and behavior

- Navigation, product copy, policies, forms and placeholders, action buttons, Guided negotiation events, authority/agreement incidents, execution steps, receipt controls, historical evidence explanations, Live connection/composer/expiry states, and known validation messages have reviewed Korean and Chinese strings.
- `i18n-catalog.mjs` contains the English source strings and both translations, including value-preserving templates for dynamic amounts and counts.
- `i18n.mjs` translates text nodes and accessible labels after each application render and asynchronous status update. Original text is retained in weak maps so switching back to English is reversible. It uses text content, never translated HTML.
- Language changes do not rerender the application, submit a form, reset a task, invoke inference, or touch transaction state. Unsaved form values and conversation scroll positions remain intact.
- The native selector is keyboard accessible, updates `html[lang]`, and survives route changes. CJK font fallbacks and responsive header wrapping are included.

## Evidence integrity

User-entered briefs, messages, task titles and source data are original content. Actual Live model messages are explicitly labeled as original and remain in the language returned by the model. Language switching is not a translation request to Kiln.

JSON, signatures, hashes, addresses, model/request identifiers, downloaded receipts and signed terms are not rewritten. Money stays in the same test unit: switching to Korean or Chinese is not KRW/CNY conversion. English diagnostics without a known translation fall back to their original text; code identifiers are retained where a localized explanation is available.

No contracts, financial rules, agent policies, STOP behavior, settlement logic, or external Seller Lab were changed.

## Validation evidence

- Related Node tests cover both catalog columns and placeholders, financial amount preservation, English fallback, existing four-step Guided settlement, Live-message routing, rendering, and explicit public asset publication.
- Browser: Korean homepage; Chinese homepage; editable Korean policy dialog; mixed Korean/Chinese draft preserved through EN → KO → ZH changes; Guided authority rejection, negotiation, agreement rejection, corrected payment, and verified receipt completed while switching languages.
- Browser: raw signature JSON compared before/after ZH → KO switch and found identical; selected language and completed transaction persisted after reload.
- Browser: Korean historical Proof and Chinese Detailed Live connection/composer screens; desktop 1440px and mobile 390px layouts; no horizontal overflow on the tested screens; keyboard Home/ArrowDown language selection.
- Local Live screens were tested without invoking a model; the static local server correctly reported Live unavailable. No replay was labeled as Live.

Screenshots are in `artifacts/accord-lock/languages/`: `home-ko-1440.png`, `home-zh-1440.png`, `agreement-zh-1440.png`, `proof-ko-1440.png`, `live-ko-mobile.png`, and `live-zh-mobile.png`.

## Maintenance

Add every new UI phrase and dynamic event template to both language columns. Keep technical evidence and user/model content marked `translate="no"` (or inside the existing excluded code/JSON regions). New arbitrary server diagnostics intentionally retain their original text until an explicit translation is added. The interface does not machine-translate arbitrary source files or model prose.
