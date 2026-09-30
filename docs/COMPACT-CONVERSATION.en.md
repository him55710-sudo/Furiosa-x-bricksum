# Compact conversation workspace

The conversation gets the main column. Policy and balances are collapsed by default and can be reopened with an accessible toolbar toggle; editing remains available. The header is compact and the message composer uses a 44px textarea with vertical resize support. Desktop focus mode can reclaim the navigation column too. The retained task/Live Deal Room also has a compact header, horizontal participant strip, wider message column and smaller composer.

Saved evidence is a historical event list with unchanged original records, incident explanations and exports. Detailed Deal Room is current terms, mandate/deal/invoice values, execution stages and available next actions. It no longer repeats the event list. Both preserve the current transaction and route.

At 1440 x 900, Korean Guided authority-block state:
- Conversation width: 850px before, 1248px after.
- Header height: 77px before, 49px after.
- Composer height: 148px before, 71px after.
- Conversation height: 371px before, 429px after.

Verified evidence has six historical cards and no execution grid; details has current terms and an execution grid with zero historical cards. Keyboard policy toggle works. At 390px the composer is 86px high and the document has no horizontal overflow. A clearly labeled static layout fixture using retained actual Live messages verifies the old Live room at 1440px: header 45px, title 25px, message region 1015 x 590px, no horizontal overflow. No new inference calls were needed.

45 relevant tests passed: conversation-room, i18n, product-workflow, presentation, spending-site, deal-room-chat, live-session-recovery, playground and accord-live-http. Production build passed with the existing bundle-size warning. Financial and model execution semantics are unchanged.

Evidence: artifacts/accord-lock/compact-room/deal-1440.png, mobile-390.png. Production screenshots are added after deployment verification.

Production deployment `dpl_93QA6ZfHNRaLFisbPZM6NTgDf2bg` is READY. The main alias served `/assets/index-7URzCeIA.js`; browser measurement confirmed 1248px conversation width and 71px composer height. Production evidence and detail controls displayed different content as intended. At 1920px, the conversation width is 1728px with no horizontal overflow. Screenshot: artifacts/accord-lock/compact-room/production-wide-ko.png.
