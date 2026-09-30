// English is the canonical UI source. Placeholders preserve displayed values exactly.
// This catalog is presentation-only; it must never be used to serialize evidence.
const rows = `
Accord Lock — The agreement decides what gets paid.|Accord Lock — 합의한 내용대로 결제합니다.|Accord Lock — 按照约定付款。
Original message · preserved as received|원문 · 수신한 내용 그대로 보존|原文 · 按收到的内容保留
Product|제품|产品
Technology|기술|技术
Roadmap|로드맵|路线图
Proof|증빙|凭证
Get started|시작하기|开始使用
THE AGREEMENT DECIDES WHAT GETS PAID.|합의한 내용대로 결제합니다.|按照约定付款。
AI agents negotiate.|AI 에이전트가 협상합니다.|AI 智能体负责协商。
You stay in control.|결정권은 당신에게 있습니다.|决定权始终在您手中。
Give your buyer a task and a budget. Watch agents negotiate. Accord Lock makes sure the payment matches the deal they signed.|구매 에이전트에게 업무와 예산을 맡기고 협상 과정을 지켜보세요. Accord Lock은 서명한 합의와 결제가 일치하는지 확인합니다.|向采购智能体分配任务和预算，观察智能体协商。Accord Lock 确保付款与双方签署的协议一致。
Try Demo|데모 체험하기|体验演示
Set your rules. Explore safely.|직접 규칙을 정하고 안전하게 체험하세요.|设定规则，安全体验。
Go Live|Live 시작하기|启动 Live
Talk to real Kiln agents.|실제 Kiln 에이전트와 대화하세요.|与真实的 Kiln 智能体对话。
No real funds. Prices such as $40, $25 and $15 are examples in test USD.|실제 자금은 사용하지 않습니다. $40, $25, $15 등은 테스트 USD로 표시한 예시 금액입니다.|不使用真实资金。$40、$25 和 $15 等价格均为测试 USD 示例金额。
Illustrative transaction, not a live session|거래 예시 · 실제 Live 세션 아님|交易示意，并非实时会话
A transaction you can trust|신뢰할 수 있는 거래|值得信赖的交易
ILLUSTRATION|설명용 예시|示意图
Your buyer|구매 에이전트|您的采购智能体
Find a sourced dataset.|출처가 있는 데이터를 찾아주세요.|请寻找有来源的数据集。
Stay within my $30 limit.|한도 $30를 지켜주세요.|请控制在 $30 限额内。
Atlas · Seller|Atlas · 판매 에이전트|Atlas · 销售智能体
I can deliver it for|제공 가능한 가격은|交付价格为
01 MANDATE|01 권한 위임|01 授权
02 DEAL|02 거래 합의|02 协议
03 RECEIPT|03 영수증|03 回执
Invoice $25 · Payment paused|청구 금액 $25 · 결제 일시 정지|账单 $25 · 付款已暂停
$25 fits the $40 budget.|$25는 예산 $40 이내입니다.|$25 在 $40 预算之内。
It does not match the $20 deal.|하지만 합의 금액 $20와 다릅니다.|但与 $20 的协议金额不符。
Agreement Gate protected your payment.|합의 검증이 결제를 보호했습니다.|协议校验保护了您的付款。
AI negotiates. Code authorizes. Evidence explains.|AI가 협상하고, 코드가 승인하고, 증거가 설명합니다.|AI 协商，代码授权，证据解释。
YOUR POLICY|나의 정책|您的规则
Total budget|총예산|总预算
Max / deal|거래당 한도|每笔限额
Signed deal|서명된 합의|已签署协议
AFTER CORRECTION|청구 정정 후|更正后
✓ $20 paid|✓ $20 지급 완료|✓ 已支付 $20
Agreement verified.|합의 검증 완료.|协议已验证。
Receipt saved.|영수증 저장 완료.|回执已保存。
Test USD · No cash value|테스트 USD · 현금 가치 없음|测试 USD · 无现金价值
The pain point|해결할 문제|痛点
A budget is not an agreement.|예산은 합의가 아닙니다.|预算不等于协议。
An affordable invoice can still be an overcharge.|예산 이내의 청구도 과다 청구일 수 있습니다.|预算范围内的账单仍可能多收费。
Agents can change terms between negotiation and payment.|협상과 결제 사이에 에이전트가 조건을 바꿀 수 있습니다.|智能体可能在协商与付款之间改变条款。
A chat log alone does not explain what was authorized.|대화 기록만으로는 승인 범위를 알 수 없습니다.|仅凭聊天记录无法说明授权范围。
The solution|솔루션|解决方案
Two gates. One accountable payment.|두 번의 검증으로 결제의 근거를 확인합니다.|两道校验，让每笔付款有据可查。
Authority Gate checks the human mandate.|권한 검증은 사람이 위임한 범위를 확인합니다.|授权校验检查人类授予的权限。
Agreement Gate checks the signed deal.|합의 검증은 서명된 거래 조건을 확인합니다.|协议校验检查已签署的交易条款。
A receipt connects the terms, delivery and payment.|영수증은 합의 조건·납품·결제를 연결합니다.|回执将条款、交付和付款关联起来。
The technology|핵심 기술|核心技术
Inference proposes. Code decides.|모델이 제안하고, 코드가 결정합니다.|模型提出建议，代码做出决定。
Actual Kiln inference with qwen3-32b.|qwen3-32b를 이용한 실제 Kiln 추론.|使用 qwen3-32b 进行真实 Kiln 推理。
Bilateral signatures and exact-amount escrow checks.|양측 서명 및 정확한 금액의 에스크로 검증.|双边签名与精确金额的托管校验。
Inspectable receipts; separate historical Sepolia evidence.|검사 가능한 영수증과 별도로 보존된 Sepolia 과거 증빙.|可核查的回执，以及独立保存的 Sepolia 历史证据。
Future expansion|미래 확장|未来拓展
Explore Furiosa NPU inference for efficient agent commerce.|효율적인 에이전트 거래를 위한 Furiosa NPU 추론을 탐색합니다.|探索 Furiosa NPU 推理以提升智能体交易效率。
Extend assurance into Bricksum payment infrastructure.|거래 보증을 Bricksum 결제 인프라로 확장합니다.|将交易保障拓展到 Bricksum 支付基础设施。
Grow from sourced data to broader digital services.|출처 기반 데이터에서 다양한 디지털 서비스로 확장합니다.|从有来源的数据服务扩展到更多数字服务。
Roadmap direction · not a claim of deployed integrations.|향후 추진 방향이며, 이미 배포된 연동을 의미하지 않습니다.|这是路线图方向，不代表相关集成已上线。
Transaction assurance for agent-to-agent commerce.|에이전트 간 거래를 위한 거래 보증 인프라.|为智能体之间的交易提供保障。
Main navigation|주요 메뉴|主导航
Product overview|제품 소개|产品概览
Skip to workspace|작업 화면으로 건너뛰기|跳转到工作区
Opening your workspace|작업 공간을 여는 중|正在打开工作区
Connecting to your local task store and escrow.|로컬 업무 저장소와 에스크로에 연결하고 있습니다.|正在连接本地任务存储和托管服务。
New purchase|새 구매|新建采购
The agreement decides|합의한 내용대로|按照约定
what gets paid.|결제합니다.|付款。
Conversation|대화|对话
Execution flow|실행 과정|执行流程
Saved evidence|저장된 증거|已保存证据
Detailed Deal Room|상세 거래실|详细交易室
Historical proof|과거 증빙|历史凭证
THIS PURCHASE · TEST USD|현재 구매 · 테스트 USD|本次采购 · 测试 USD
spent|지출|已支出
{0} uncommitted authority|미사용 권한 {0}|未使用授权 {0}
Back to product|제품 소개로|返回产品页
Expand conversation|대화 크게 보기|展开对话
Show policy panels|정책 패널 보기|显示规则面板
Guided Demo|가이드 데모|引导演示
Live Agents|Live 에이전트|Live 智能体
DEMO · Deterministic agents|데모 · 정해진 규칙의 에이전트|演示 · 确定性智能体
LIVE · Kiln / qwen3-32b|LIVE · Kiln / qwen3-32b|LIVE · Kiln / qwen3-32b
TALK TO YOUR AGENTS|에이전트에게 직접 요청하세요|直接向智能体提出要求
EXPLORE AGENT COMMERCE|에이전트 거래 체험|体验智能体交易
Find it. Negotiate it.|찾고, 협상하세요.|寻找、协商。
We’ll lock it.|합의는 우리가 지킵니다.|我们来锁定协议。
Send your instructions. The agents respond through actual Kiln inference.|지시를 보내세요. 에이전트가 실제 Kiln 추론으로 응답합니다.|发送您的指令，智能体通过真实 Kiln 推理作出回应。
Watch the conversation. Step in when the agreement needs you.|대화를 지켜보고, 결정이 필요한 순간 직접 참여하세요.|观察对话，在需要决策时介入。
$ = test USD · No real funds|$ = 테스트 USD · 실제 자금 사용 없음|$ = 测试 USD · 不使用真实资金
Progress saved|진행 상황 저장됨|进度已保存
Your policy is editable|정책을 수정할 수 있습니다|规则可编辑
Agent conversation|에이전트 대화|智能体对话
Seller offers|판매 제안|卖方报价
Request an offer|제안 요청|请求报价
Over your limit|한도 초과|超出限额
Within spending limit|지출 한도 이내|在支出限额内
Agents stopped|에이전트 중지됨|智能体已停止
New commitments are disabled. Recorded work remains inspectable.|새로운 약정은 중단됩니다. 기록된 업무는 계속 확인할 수 있습니다.|已禁止新增承诺，现有工作记录仍可查看。
Next transaction action|다음 거래 동작|下一步交易操作
Inspect technical proof|기술 증빙 확인|查看技术凭证
Accept & sign terms|조건 수락 및 서명|接受条款并签署
Stop agents|에이전트 중지|停止智能体
Stop buyer|구매 에이전트 중지|停止采购智能体
Refresh connection|연결 새로고침|刷新连接
Message the agents|에이전트에게 메시지 보내기|向智能体发送消息
Your task / negotiation instruction|업무 요청 / 협상 지시|任务请求 / 协商指令
Ask for a lower price while preserving all source coverage…|출처 범위를 유지하면서 가격을 낮춰 달라고 요청하세요…|要求降低价格，同时保留所有来源覆盖范围…
Add a note and choose your counteroffer below…|메시지를 쓰고 아래에서 역제안 금액을 정하세요…|添加说明，并在下方设定还价金额…
Describe what your buyer should do…|구매 에이전트에게 맡길 업무를 입력하세요…|描述您希望采购智能体完成的任务…
Counteroffer · test USD|역제안 · 테스트 USD|还价 · 测试 USD
Sent to Kiln. Messages cannot override your policy.|Kiln으로 전송됩니다. 메시지로 정책을 우회할 수 없습니다.|消息将发送至 Kiln，不能绕过您的规则。
Demo runs the existing sample source-table worker.|데모는 기존 샘플 원본 표 처리기를 실행합니다.|演示运行现有的示例源表处理程序。
Send|보내기|发送
Send task|업무 보내기|发送任务
Reduce motion|애니메이션 줄이기|减少动画
{0} saved entries|저장된 기록 {0}개|已保存 {0} 条记录
Export conversation & incidents|대화 및 사건 내보내기|导出对话与事件
Your policy|나의 정책|您的规则
Edit|수정|编辑
Max per transaction|거래당 최대 금액|每笔交易上限
Currency|통화|币种
Test USD|테스트 USD|测试 USD
test USD|테스트 USD|测试 USD
Approved sellers|허용된 판매자|获准卖方
Delivery deadline|납품 기한|交付期限
≤ {0} min|≤ {0}분|≤ {0} 分钟
Signed terms stay immutable.|서명된 조건은 변경되지 않습니다.|已签署的条款不可更改。
You define the limits, including in Demo.|데모에서도 직접 한도를 정합니다.|包括演示模式在内，限额由您设定。
Current deal|현재 거래|当前交易
Paid|지급 완료|已支付
Locked|잠김|已锁定
Not signed|미서명|未签署
Signed amount|서명된 금액|已签署金额
Seller invoice|판매자 청구 금액|卖方账单
In escrow|에스크로 보관 중|托管中
Back to conversation|대화로 돌아가기|返回对话
View execution flow|실행 과정 보기|查看执行流程
Where the money is|자금 현황|资金去向
Buyer spent|구매자 지출|买方支出
Seller received|판매자 수령|卖方收入
Remaining authority|남은 권한|剩余授权
Remaining = budget − escrow − paid.|잔여 한도 = 예산 − 에스크로 − 지급액.|剩余额度 = 预算 − 托管额 − 已支付额。
Authority is a limit, not a wallet deposit.|권한은 지출 한도이며 지갑 잔액이 아닙니다.|授权是支出限额，并非钱包存款。
AI negotiates.|AI가 협상합니다.|AI 协商。
Code authorizes.|코드가 승인합니다.|代码授权。
Evidence explains.|증거가 설명합니다.|证据解释。
Current execution: private EVM.|현재 실행: 프라이빗 EVM.|当前执行环境：私有 EVM。
Historical Sepolia evidence|Sepolia 과거 증빙|Sepolia 历史证据
YOUR AUTHORITY|나의 권한|您的授权
Policy for a new purchase|새 구매에 적용할 정책|新采购规则
Edit your policy|정책 수정|编辑规则
The existing mandate stays unchanged. These settings start a separate purchase.|기존 위임은 유지됩니다. 이 설정은 별도의 새 구매에 적용됩니다.|现有授权不变，这些设置将用于一笔新的采购。
Your limits control the real validation, including in Demo.|설정한 한도는 데모에서도 실제 검증에 적용됩니다.|您设定的限额会用于实际校验，包括演示模式。
Task title|업무 제목|任务标题
Task brief|업무 설명|任务说明
Total budget · test USD|총예산 · 테스트 USD|总预算 · 测试 USD
Max / deal · test USD|거래당 한도 · 테스트 USD|每笔限额 · 测试 USD
Delivery deadline · minutes|납품 기한 · 분|交付期限 · 分钟
Test USD has no cash value. The sample includes four source-linked records. Use Detailed Deal Room for your own source file.|테스트 USD에는 현금 가치가 없습니다. 샘플에는 출처가 연결된 기록 4개가 포함됩니다. 직접 준비한 파일은 상세 거래실에서 사용하세요.|测试 USD 无现金价值。示例包含 4 条关联来源的记录。请在详细交易室使用您自己的源文件。
Use for a new purchase|새 구매에 적용|用于新采购
Save policy|정책 저장|保存规则
Close dialog|창 닫기|关闭对话框
You|나|您
Buyer|구매 에이전트|采购智能体
Seller|판매 에이전트|销售智能体
What should your buyer find?|구매 에이전트가 무엇을 찾을까요?|您希望采购智能体寻找什么？
Describe the task below and edit your budget on the right.|아래에 업무를 입력하고 정책에서 예산을 수정하세요.|在下方描述任务，并在规则中编辑预算。
Your message goes to real Kiln agents.|메시지가 실제 Kiln 에이전트에게 전송됩니다.|您的消息将发送给真实的 Kiln 智能体。
Demo uses deterministic agents; no LLM call or real money.|데모는 정해진 규칙으로 작동합니다. LLM 호출이나 실제 자금은 사용하지 않습니다.|演示使用确定性智能体，不调用 LLM，也不使用真实资金。
“Find four source-linked CAPEX records.|“출처가 있는 CAPEX 기록 4개를 찾아주세요.|“请寻找 4 条关联来源的 CAPEX 记录。
Keep the price within my policy.”|설정한 가격 한도를 지켜주세요.”|价格请保持在我的规则范围内。”
Task delegated|업무 위임됨|任务已委派
Instruction|지시|指令
Kiln agent|Kiln 에이전트|Kiln 智能体
Protection event|보호 사건|防护事件
Execution event|실행 기록|执行事件
Demo · deterministic|데모 · 규칙 기반|演示 · 确定性
Gate incident saved · Inspect below|차단 사건 저장됨 · 아래에서 확인|校验事件已保存 · 请在下方查看
Actual request in progress|실제 요청 처리 중|正在处理真实请求
Applying your decision|결정 적용 중|正在执行您的决定
Processing the current request…|현재 요청 처리 중…|正在处理当前请求…
Ⅱ PAUSED · AUTHORITY GATE|Ⅱ 일시 정지 · 권한 검증|Ⅱ 已暂停 · 授权校验
{0} exceeds your {1} limit.|{0}가 한도 {1}를 초과합니다.|{0} 超出您的 {1} 限额。
No signature. No escrow. No funds moved. Negotiate a lower price or edit your policy.|서명·에스크로·자금 이동이 없습니다. 가격을 낮춰 협상하거나 정책을 수정하세요.|未签名、未托管、未转移资金。请协商更低价格或编辑规则。
Inspect saved incident|저장된 사건 확인|查看已保存事件
Ⅱ PAUSED · AGREEMENT GATE|Ⅱ 일시 정지 · 합의 검증|Ⅱ 已暂停 · 协议校验
The invoice changed. Your agreement did not.|청구 금액이 바뀌었습니다. 합의는 그대로입니다.|账单变了，协议没有变。
Within budget|예산 이내|预算内
Over budget|예산 초과|超出预算
Payment blocked|결제 차단|付款已拦截
Escrow stays locked. Review this saved incident before approving anything.|에스크로는 잠겨 있습니다. 승인하기 전에 저장된 사건을 확인하세요.|托管资金保持锁定。批准前请查看已保存事件。
PROPOSAL REJECTED|제안 거부됨|提案被拒绝
The failed attempt is recorded. Retry or switch seller; no success has been invented.|실패한 시도도 기록됩니다. 다시 시도하거나 판매자를 바꾸세요. 성공으로 표시하지 않습니다.|失败尝试也会记录。请重试或切换卖方，系统不会虚构成功。
Inspect rejected attempt|거부된 시도 확인|查看被拒绝的尝试
✓ RECEIPT VERIFIED|✓ 영수증 검증 완료|✓ 回执已验证
{0} paid. Exactly as agreed.|합의한 대로 {0} 지급 완료.|已支付 {0}，与协议完全一致。
Agreement verified · Payment matched · Settled once|합의 검증 완료 · 결제 일치 · 1회 정산|协议已验证 · 付款一致 · 仅结算一次
Inspect receipt|영수증 확인|查看回执
01 · MANDATE|01 · 권한 위임|01 · 授权
02 · AUTHORITY GATE|02 · 권한 검증|02 · 授权校验
03 · NEGOTIATION|03 · 협상|03 · 协商
04 · DEAL|04 · 거래 합의|04 · 协议
05 · ESCROW|05 · 에스크로|05 · 托管
06 · DELIVERY|06 · 납품|06 · 交付
07 · AGREEMENT GATE|07 · 합의 검증|07 · 协议校验
08 · SETTLEMENT|08 · 정산|08 · 结算
09 · RECEIPT|09 · 영수증|09 · 回执
Delegated|위임됨|已授权
Not delegated|미위임|未授权
{0} budget · {1} max|예산 {0} · 한도 {1}|预算 {0} · 上限 {1}
Blocked|차단됨|已拦截
Quotes checked|견적 확인됨|报价已检查
Awaiting offers|제안 대기 중|等待报价
{0} exceeded authority|{0} 권한 초과|{0} 超出授权
Budget · seller · expiry|예산 · 판매자 · 만료|预算 · 卖方 · 到期时间
Awaiting terms|조건 대기 중|等待条款
Buyer ↔ {0}|구매 에이전트 ↔ {0}|采购智能体 ↔ {0}
Buyer + seller signed|구매자 + 판매자 서명 완료|买卖双方已签署
No bilateral signature confirmed|양측 서명 미확인|尚未确认双边签名
Released|지급됨|已释放
Not funded|미입금|未注资
Confirmed transactions only|확인된 거래만 표시|仅显示已确认交易
{0} records|기록 {0}개|{0} 条记录
Awaiting work|업무 대기 중|等待执行
Acceptance checks passed|검수 통과|验收通过
Source-linked evidence|출처 연결 증거|关联来源的证据
Awaiting invoice|청구 대기 중|等待账单
Invoice matched|청구 금액 일치|账单一致
Signed terms decide payment|서명된 조건으로 결제 결정|按已签署条款决定付款
{0} paid|{0} 지급 완료|已支付 {0}
No payment|지급 없음|未付款
{0} receives confirmed payment|{0}에 확인된 금액 지급|{0} 收到已确认付款
Verified|검증됨|已验证
Created|생성됨|已创建
Awaiting settlement|정산 대기 중|等待结算
Evidence explains what happened|증거로 거래 결과 확인|证据说明交易结果
TRANSACTION PATH · TEST USD|거래 흐름 · 테스트 USD|交易流程 · 测试 USD
Every step follows the actual transaction.|모든 단계는 실제 거래 상태를 따릅니다.|每一步都对应真实交易状态。
Click a step to inspect the recorded evidence. Future steps stay pending.|단계를 눌러 기록된 증거를 확인하세요. 아직 실행되지 않은 단계는 대기 상태로 남습니다.|点击步骤查看记录的证据。尚未执行的步骤保持待处理状态。
Delegate task|업무 위임|委派任务
Continue delegation|위임 계속하기|继续授权
Approve signed Deal|서명된 거래 승인|批准已签署协议
Let Buyer negotiate|구매 에이전트에게 협상 맡기기|让采购智能体协商
Continue approved deal|승인된 거래 계속하기|继续已批准交易
Pay corrected invoice|정정된 청구 결제|支付更正后的账单
Pay agreed invoice|합의된 청구 결제|支付约定账单
Verify receipt|영수증 검증|验证回执
Delegate to Live agents|Live 에이전트에 위임|委派给 Live 智能体
Approve & pay {0}|승인하고 {0} 지급|批准并支付 {0}
Request {0} offer|{0}에 제안 요청|请求 {0} 报价
Let {0} respond|{0}에 응답 요청|让 {0} 回应
Processing…|처리 중…|处理中…
Waiting for response…|응답 대기 중…|等待回应…
Working…|작업 중…|正在执行…
Budget|예산|预算
Authority Gate|권한 검증|授权校验
Agreement Gate|합의 검증|协议校验
Mandate|권한 위임|授权
Deal|거래 합의|协议
Receipt|영수증|回执
Delivery|납품|交付
Settlement|정산|结算
Escrow|에스크로|托管
Negotiation|협상|协商
Amount|금액|金额
Status|상태|状态
Pending|대기 중|待处理
Confirmed|확인됨|已确认
Unconfirmed|미확인|未确认
Reverted|거래 되돌림|交易已回退
Stopped|중지됨|已停止
Ready|준비됨|已就绪
Protected|보호됨|已保护
Passed|통과|已通过
Negotiating|협상 중|协商中
Accepted|수락됨|已接受
Declined|거절됨|已拒绝
Proposed|제안됨|已提议
offer|제안|报价
accept|수락|接受
decline|거절|拒绝
test units|테스트 단위|测试单位
minutes|분|分钟
{0} min|{0}분|{0} 分钟
{0} sources|출처 {0}개|{0} 个来源
{0} source|출처 {0}개|{0} 个来源
Records|기록|记录
Sources|출처|来源
Overview|개요|概览
Deal Room|거래실|交易室
Deals|거래 내역|交易记录
Agents & roles|에이전트와 역할|智能体与角色
Workspace|작업 공간|工作区
WORKSPACE|작업 공간|工作区
Presentation|프레젠테이션|演示视图
Agent transactions|에이전트 거래|智能体交易
Agreement enforcement|합의 이행 검증|协议执行校验
New deal|새 거래|新建交易
Money follows the agreement.|자금은 합의를 따릅니다.|资金遵循协议。
Always.|언제나.|始终如此。
Execution mode|실행 모드|执行模式
GUIDED DEMO|가이드 데모|引导演示
LIVE AGENTS|LIVE 에이전트|LIVE 智能体
Inspect proof|증빙 확인|查看凭证
Execution & trust boundaries|실행 및 신뢰 범위|执行与信任边界
Saved in this browser|이 브라우저에 저장됨|保存在此浏览器中
Saved on this computer|이 컴퓨터에 저장됨|保存在此电脑中
Deterministic agent simulation|규칙 기반 에이전트 시뮬레이션|确定性智能体模拟
Test units|테스트 단위|测试单位
Actual model proposals|실제 모델 제안|真实模型提案
Private agent policies|비공개 에이전트 정책|智能体私有规则
Operator-controlled actions.|운영자가 동작을 제어합니다.|操作由用户控制。
Kiln negotiated terms|Kiln 협상 조건|Kiln 协商条款
Rule-based source processing|규칙 기반 원본 처리|基于规则的源数据处理
Private-EVM test settlement.|프라이빗 EVM 테스트 정산.|私有 EVM 测试结算。
Your tasks|나의 업무|您的任务
SAVED ON THIS COMPUTER|이 컴퓨터에 저장됨|保存在此电脑中
Create a task to start your work history.|업무를 만들면 이력이 기록됩니다.|创建任务即可开始记录工作历史。
Inspect model evidence|모델 증거 확인|查看模型证据
Inspect full event timeline|전체 사건 타임라인 확인|查看完整事件时间线
Inspect rejected attempts & usage|거부된 시도 및 사용량 확인|查看被拒绝的尝试及用量
Download result|결과 다운로드|下载结果
Download receipt|영수증 다운로드|下载回执
Open Detailed Deal Room|상세 거래실 열기|打开详细交易室
No recorded negotiation yet.|아직 기록된 협상이 없습니다.|尚无协商记录。
Delegate a task to create a transaction.|업무를 위임해 거래를 시작하세요.|委派任务以创建交易。
Human authority|사람이 부여한 권한|人类授予的权限
Human budget|사람이 정한 예산|人类设定的预算
Maximum per deal|거래당 최대 금액|每笔交易上限
Delivery evidence|납품 증거|交付证据
Budget · per-deal limit · permitted seller · expiry · revocation|예산 · 거래당 한도 · 허용 판매자 · 만료 · 권한 철회|预算 · 每笔限额 · 获准卖方 · 到期 · 撤销
Is the agent allowed to make this commitment?|에이전트에게 이 약정을 체결할 권한이 있나요?|该智能体是否有权作出此承诺？
Amount · recipient · deal hash · signed terms · supported delivery conditions|금액 · 수령자 · 거래 해시 · 서명된 조건 · 지원되는 납품 조건|金额 · 收款人 · 协议哈希 · 已签条款 · 支持的交付条件
Is this payment what both sides committed to?|이 결제는 양측이 합의한 내용과 일치하나요?|这笔付款是否符合双方的约定？
Not received|미수신|未收到
Current execution: private EVM test units. Historical public Sepolia evidence is separate.|현재 실행은 프라이빗 EVM 테스트 단위입니다. 공개 Sepolia 과거 증빙은 별도 기록입니다.|当前执行使用私有 EVM 测试单位。公开 Sepolia 历史证据独立保存。
INSPECT TRANSACTION|거래 검사|检查交易
GUIDED|가이드|引导
Invoice|청구 금액|账单
Model|모델|模型
Model: {0}|모델: {0}|模型：{0}
Request ID|요청 ID|请求 ID
Input scope|입력 범위|输入范围
Public input|공개 입력|公开输入
Model output|모델 출력|模型输出
Measured usage|측정된 사용량|测得用量
ACTUAL MODEL RESPONSE|실제 모델 응답|真实模型响应
LIVE AGREEMENT PROOF|LIVE 합의 증빙|LIVE 协议凭证
Both agents signed.|양측 에이전트 서명 완료.|双方智能体已签署。
No agreement signed yet.|아직 서명된 합의가 없습니다.|尚未签署协议。
Actual model proposals. Separate operator-owned signing identities. Private-EVM funding requires your approval.|실제 모델 제안과 운영자가 소유한 별도 서명 신원을 사용합니다. 프라이빗 EVM 입금에는 사용자 승인이 필요합니다.|使用真实模型提案和运营方持有的独立签名身份。私有 EVM 注资需要您的批准。
Model attempts|모델 호출 시도|模型调用尝试
Every attempted call counts. Rejected responses cannot authorize funds.|모든 호출 시도를 계산합니다. 거부된 응답으로 자금을 승인할 수 없습니다.|每次调用尝试都会计数。被拒绝的回应不能授权资金。
DEAL PROOF|거래 증빙|交易凭证
Inspect the agreement.|합의 내용 확인.|查看协议。
Agreement hash|합의 해시|协议哈希
No agreement committed yet|아직 확정된 합의 없음|尚未确认协议
Buyer / seller signatures|구매자 / 판매자 서명|买方 / 卖方签名
Buyer and seller workspace signatures bind this escrow agreement.|구매자와 판매자의 작업 공간 서명이 에스크로 합의를 확정합니다.|买卖双方的工作区签名绑定此托管协议。
No workspace signatures yet|아직 작업 공간 서명 없음|尚无工作区签名
Network|네트워크|网络
Contract|컨트랙트|合约
Not deployed yet|아직 배포되지 않음|尚未部署
Live agent agreement|Live 에이전트 합의|Live 智能体协议
Workspace agreement signatures|작업 공간 합의 서명|工作区协议签名
Verify on local chain|로컬 체인에서 검증|在本地链上验证
Application checks enforce authority and exact invoices before the trusted controller signs. This private chain is separate from the recorded public proof.|신뢰된 제어기가 서명하기 전에 애플리케이션이 권한과 정확한 청구 금액을 검사합니다. 이 프라이빗 체인은 공개 증빙 기록과 별개입니다.|可信控制器签名前，应用会检查授权与精确账单金额。此私有链与已记录的公开凭证相互独立。
See public Sepolia proof|공개 Sepolia 증빙 보기|查看公开 Sepolia 凭证
RECEIPT VERIFICATION|영수증 검증|回执验证
Checked the receipt against the current local chain.|현재 로컬 체인과 영수증을 대조했습니다.|已根据当前本地链核验回执。
LOCAL EVM RECEIPT|로컬 EVM 영수증|本地 EVM 回执
Escrow funding|에스크로 입금|托管注资
Seller payment|판매자 지급|卖方付款
Buyer refund|구매자 환불|买方退款
Transaction|거래|交易
Block|블록|区块
Chain {0}. Local transactions have no public explorer URL.|체인 {0}. 로컬 거래에는 공개 탐색기 URL이 없습니다.|链 {0}。本地交易没有公开浏览器链接。
Retry connection|다시 연결|重新连接
Open your browser workspace|브라우저 작업 공간 열기|打开浏览器工作区
Start your Accord Lock workspace|Accord Lock 작업 공간 시작|启动 Accord Lock 工作区
Use a recent browser with site storage enabled. No local server is required.|사이트 저장소가 활성화된 최신 브라우저를 사용하세요. 로컬 서버는 필요하지 않습니다.|请使用启用站点存储的较新浏览器，无需本地服务器。
This workspace needs its local task and escrow service.|이 작업 공간에는 로컬 업무 및 에스크로 서비스가 필요합니다.|此工作区需要本地任务与托管服务。
Workspace views|작업 화면|工作区视图
`;
const detailRows = `
PAYMENT PROOF|결제 증빙|付款凭证
What was agreed.|무엇에 합의했는지.|双方约定了什么。
What actually got paid.|실제로 얼마를 지급했는지.|实际支付了多少。
A clear record of the agreement, the payment check, and the outcome.|합의·결제 검증·결과를 명확하게 기록합니다.|清晰记录协议、付款校验和最终结果。
Proof is unavailable.|증빙을 불러올 수 없습니다.|凭证暂不可用。
We cannot confirm the payment outcome without its recorded evidence.|기록된 증거 없이는 결제 결과를 확인할 수 없습니다.|没有记录的证据，无法确认付款结果。
Open saved evidence|저장된 증거 열기|打开已保存证据
Open verification report|검증 보고서 열기|打开验证报告
HISTORICAL SEPOLIA RECORD|SEPOLIA 과거 기록|SEPOLIA 历史记录
Recorded {0} · Test funds, no cash value|기록일 {0} · 테스트 자금, 현금 가치 없음|记录于 {0} · 测试资金，无现金价值
Payment outcome|결제 결과|付款结果
The seller received exactly what was agreed.|판매자가 합의한 금액만 정확히 수령했습니다.|卖方收到的金额与约定完全一致。
Inspect the recorded payment outcome.|기록된 결제 결과를 확인하세요.|查看记录的付款结果。
The higher invoice was stopped.|더 높은 금액의 청구를 차단했습니다.|更高金额的账单已被拦截。
Only the agreed amount reached the seller.|합의한 금액만 판매자에게 전달되었습니다.|只有约定金额到达卖方。
Seller receipt is not confirmed by this record.|이 기록에서는 판매자 수령이 확인되지 않습니다.|此记录未确认卖方收款。
Record verified|기록 검증됨|记录已验证
Verification not confirmed|검증 미확인|尚未确认验证结果
01 / BOTH AGENTS AGREED|01 / 양측 에이전트 합의|01 / 双方智能体达成协议
The price was locked.|가격이 확정되었습니다.|价格已锁定。
Buyer and seller committed to the same terms.|구매자와 판매자가 동일한 조건을 약정했습니다.|买卖双方承诺了相同条款。
02 / SELLER REQUESTED|02 / 판매자 청구|02 / 卖方请求付款
Higher invoice blocked.|과다 청구 차단됨.|更高账单已被拦截。
Rejection not confirmed.|차단 미확인.|尚未确认拦截结果。
This did not match the signed deal. No payment was made for this invoice.|서명된 합의와 일치하지 않습니다. 이 청구에 대한 지급은 없습니다.|与已签署协议不符，未支付此账单。
Open the technical record to check this invoice.|기술 기록을 열어 이 청구를 확인하세요.|打开技术记录以核查此账单。
03 / SELLER RECEIVED|03 / 판매자 수령|03 / 卖方已收款
Exact payment received.|정확한 금액 수령 완료.|已收到准确金额。
Receipt needs inspection.|수령 증빙 확인 필요.|需要检查收款凭证。
The corrected invoice matched. Settlement and withdrawal are confirmed.|정정된 청구가 합의와 일치합니다. 정산과 출금이 확인되었습니다.|更正后的账单一致，已确认结算和提现。
The available record does not confirm seller withdrawal.|현재 기록에서는 판매자 출금이 확인되지 않습니다.|现有记录未确认卖方提现。
Why the invoice was blocked|청구가 차단된 이유|账单被拦截的原因
WHY THE CHECK MATTERS|검증이 필요한 이유|为什么需要校验
A budget is not permission|예산이 있다고 해서|有预算并不意味着
to change the price.|가격을 바꿀 수는 없습니다.|可以改变价格。
The human allowed|사람이 허용한 총액은|人类授权总额为
in total. The agents agreed to|입니다. 에이전트의 합의 금액은|，智能体约定金额为
for this deal.|입니다.|。
Within the total budget|총예산 이내|在总预算内
Exceeds the total budget|총예산 초과|超出总预算
Does not match the agreement|합의와 불일치|与协议不符
Matches the agreement|합의와 일치|与协议一致
This is a saved public-chain execution, separate from your current purchase and browser-private EVM. DEMO is a test accounting unit, not USD. Delivery quality still relies on an evaluator.|저장된 공개 체인 실행 기록이며 현재 구매 및 브라우저 프라이빗 EVM과 별개입니다. DEMO는 USD가 아닌 테스트 회계 단위입니다. 납품 품질은 평가자에 의존합니다.|这是已保存的公链执行记录，与当前采购和浏览器私有 EVM 分开。DEMO 是测试记账单位，并非 USD。交付质量仍依赖评估者。
Blockchain transactions, verification reports, and model evidence|블록체인 거래·검증 보고서·모델 증거|区块链交易、验证报告与模型证据
Blockchain transaction record|블록체인 거래 기록|区块链交易记录
1 DEMO = 100 gwei of Sepolia test ETH. Browser demo uses 1 test unit = 1 local gwei. Neither has cash value. Gas is recorded separately.|1 DEMO = Sepolia 테스트 ETH 100 gwei입니다. 브라우저 데모는 1 테스트 단위 = 로컬 1 gwei를 사용합니다. 둘 다 현금 가치가 없으며 가스는 별도로 기록됩니다.|1 DEMO = 100 gwei 的 Sepolia 测试 ETH。浏览器演示使用 1 测试单位 = 1 本地 gwei。两者均无现金价值，Gas 单独记录。
Human authority recorded|사람의 권한 기록됨|人类授权已记录
Agreed amount secured in escrow|합의 금액 에스크로 보관|约定金额已托管
Higher invoice rejected|과다 청구 거부됨|更高账单已拒绝
Agreed payment settled|합의 금액 정산 완료|约定款项已结算
Seller received payment|판매자 수령 완료|卖方已收款
{0} finalized checks.|최종 확정 검사 {0}건.|{0} 项最终确认检查。
Recorded block {0}. This is a saved verification result, not a new chain check.|기록 블록 {0}. 저장된 검증 결과이며 새로운 체인 검사가 아닙니다.|记录区块 {0}。这是保存的验证结果，不是新的链上检查。
Original execution bundle|원본 실행 묶음|原始执行数据包
Finalized verification|최종 확정 검증|最终确认验证
Model evidence|모델 증거|模型证据
{0} actual Kiln API calls · {1} tokens · {2}. Models proposed the terms. Code checked authority, invoices and settlement.|실제 Kiln API 호출 {0}회 · 토큰 {1}개 · {2}. 모델이 조건을 제안하고 코드가 권한·청구·정산을 검사했습니다.|{0} 次真实 Kiln API 调用 · {1} 个 token · {2}。模型提出条款，代码检查授权、账单和结算。
Flow|흐름|流程
Calls|호출|调用
Input tokens|입력 토큰|输入 token
Output tokens|출력 토큰|输出 token
No NPU power telemetry was collected. Token usage is not measured energy savings. Failed development attempts remain in the usage ledger.|NPU 전력 측정값은 수집하지 않았습니다. 토큰 사용량은 실측 에너지 절감량이 아닙니다. 개발 중 실패한 시도도 사용량 원장에 남습니다.|未采集 NPU 功耗遥测数据。Token 用量不代表实测节能。开发中的失败尝试仍保留在用量账本中。
All-run usage ledger|전체 실행 사용량 원장|全部运行用量账本
Automated test summary|자동 테스트 요약|自动化测试摘要
Zero-inference boundary runs|추론 없는 경계 조건 실행|无推理边界测试
Token-ceiling experiments|토큰 상한 실험|Token 上限实验
Verification boundaries|검증 범위|验证边界
Public DealTrace V2 checks signed agreement amounts and human authority on Sepolia. An evaluator is trusted for delivery quality; the chain does not establish whether a CAPEX claim is true. Browser-private EVM checks run in application code before signing; its controller is trusted.|공개 DealTrace V2는 Sepolia에서 서명된 합의 금액과 사람의 권한을 확인합니다. 납품 품질은 평가자를 신뢰하며, 체인은 CAPEX 정보의 진위를 입증하지 않습니다. 브라우저 프라이빗 EVM은 신뢰된 제어기의 서명 전에 애플리케이션 코드로 검사합니다.|公开 DealTrace V2 在 Sepolia 检查已签署的协议金额与人类授权。交付质量依赖可信评估者，链本身不证明 CAPEX 内容的真实性。浏览器私有 EVM 在可信控制器签名前通过应用代码进行检查。
Earlier escrow scenarios|이전 에스크로 시나리오|早期托管场景
Separate historical amounts and runs covering refund, recovery, and outcome-driven restrictions.|환불·복구·결과 기반 제한을 다루는 별도의 과거 금액과 실행 기록입니다.|包含退款、恢复和基于结果的限制的独立历史金额与运行记录。
Earlier report|이전 보고서|早期报告
Earlier verification|이전 검증|早期验证
Failed delivery|납품 실패|交付失败
Buyer recovery|구매자 복구|买方恢复
REAL NEGOTIATION, VISIBLE EVIDENCE|실제 협상, 확인 가능한 증거|真实协商，可见证据
Give your agents a mandate.|에이전트에게 권한을 위임하세요.|向智能体授予权限。
Actual Kiln · qwen3-32b calls. Private seller policies. Every proposal is inspectable.|실제 Kiln · qwen3-32b 호출과 판매자별 비공개 정책을 사용합니다. 모든 제안을 확인할 수 있습니다.|真实调用 Kiln · qwen3-32b，卖方规则保持私有，每项提案均可检查。
Kiln service connected|Kiln 서비스 연결됨|已连接 Kiln 服务
Live service unavailable|Live 서비스 연결 불가|Live 服务不可用
Checking the live service|Live 서비스 확인 중|正在检查 Live 服务
Start with four referenced CAPEX records.|출처가 있는 CAPEX 기록 4개로 시작하세요.|从 4 条有来源的 CAPEX 记录开始。
Use this task’s source table and spending authority.|이 업무의 원본 표와 지출 권한을 사용합니다.|使用此任务的源表与支出授权。
The sample has a budget of 40 and a per-deal limit of 30. You can also create a deal with your own source table.|샘플 예산은 테스트 단위 40, 거래당 한도는 30입니다. 직접 준비한 원본 표로 거래를 만들 수도 있습니다.|示例预算为 40 个测试单位，每笔限额为 30。您也可以用自己的源表创建交易。
Use my own source table|내 원본 표 사용|使用我的源表
Your brief and source count go to Kiln; source rows stay in this workspace. Up to 8 model calls per session. {0} calls remain in this deployment’s fixed service allowance. No real funds.|업무 설명과 출처 수는 Kiln으로 전송되며 원본 행은 작업 공간에 남습니다. 세션당 모델 호출은 최대 8회입니다. 배포 서비스의 고정 한도 중 {0}회가 남았습니다. 실제 자금은 사용하지 않습니다.|任务说明与来源数量会发送至 Kiln，源数据行保留在工作区。每个会话最多调用模型 8 次，此部署的固定服务额度剩余 {0} 次。不使用真实资金。
LIVE AGENT DEAL ROOM|LIVE 에이전트 거래실|LIVE 智能体交易室
Agreement signed|합의 서명 완료|协议已签署
Live deal control summary|Live 거래 요약|Live 交易控制摘要
Agreed|합의됨|已约定
PARTICIPANTS|참여자|参与方
Buyer agent|구매 에이전트|采购智能体
Minimize cost. Preserve source coverage. Stay inside your mandate.|비용을 줄이고 출처 범위를 유지하며 위임된 권한을 지킵니다.|降低成本、保留来源覆盖范围，并遵守授权。
Source-first research|출처 우선 조사|来源优先的研究
Fast delivery|빠른 납품|快速交付
Quality & depth|품질과 깊이|质量与深度
Each seller receives only its own private policy. The buyer cannot read their price floors.|각 판매자는 자신의 비공개 정책만 받습니다. 구매자는 판매자의 최저 가격을 볼 수 없습니다.|每个卖方仅接收自己的私有规则，买方无法读取其底价。
Live negotiation|Live 협상|Live 协商
{0} / 8 calls|호출 {0} / 8회|{0} / 8 次调用
Live agent conversation|Live 에이전트 대화|Live 智能体对话
Inspect model input & output|모델 입력·출력 확인|查看模型输入与输出
READY FOR A REAL PROPOSAL|실제 제안 요청 준비 완료|已准备好请求真实提案
Ask {0} to quote.|{0}에 견적을 요청하세요.|请向 {0} 请求报价。
The agent will read your public brief and its own private policy. You choose when to continue.|에이전트는 공개 업무 설명과 자신의 비공개 정책을 읽습니다. 다음 단계는 직접 결정하세요.|智能体将读取公开任务说明和自身私有规则，由您决定何时继续。
AUTHORITY GATE · PROTECTED|권한 검증 · 보호됨|授权校验 · 已保护
No agreement signed. No escrow funded. Continue negotiating or choose another agent.|서명된 합의와 에스크로 입금이 없습니다. 협상을 계속하거나 다른 에이전트를 선택하세요.|尚未签署协议，也未向托管注资。请继续协商或选择其他智能体。
ACCORD · AGREEMENT SIGNED|ACCORD · 합의 서명 완료|ACCORD · 协议已签署
Buyer signed|구매자 서명 완료|买方已签署
{0} signed|{0} 서명 완료|{0} 已签署
Failed calls still count toward the allowance. Reference: {0}|실패한 호출도 한도에 포함됩니다. 참조: {0}|失败调用仍占用额度。参考：{0}
A {0} request is running. You can stop it or refresh the saved state.|{0} 요청을 처리 중입니다. 중지하거나 저장된 상태를 새로고침할 수 있습니다.|正在执行 {0} 请求。您可以停止或刷新已保存状态。
This session has used its 8 model calls. Accept eligible terms or start a new negotiation.|이 세션의 모델 호출 8회를 모두 사용했습니다. 유효한 조건을 수락하거나 새 협상을 시작하세요.|此会话已用完 8 次模型调用。请接受符合条件的条款或开始新协商。
Authority revoked. No further proposals or signatures can be created.|권한이 철회되었습니다. 추가 제안과 서명을 생성할 수 없습니다.|授权已撤销，无法创建更多提案或签名。
Approve signed deal & lock {0}|서명된 거래 승인 및 {0} 예치|批准已签协议并托管 {0}
Ask {0} to respond|{0}에 응답 요청|请 {0} 回应
Ask Buyer to negotiate|구매 에이전트에 협상 요청|请采购智能体协商
Accept & sign these terms|이 조건 수락 및 서명|接受并签署这些条款
Refresh state|상태 새로고침|刷新状态
New negotiation|새 협상|新协商
Accord Control|Accord 검증|Accord 控制
HUMAN MANDATE|사람이 위임한 권한|人类授权
Max per deal|거래당 한도|每笔限额
CURRENT AGREEMENT|현재 합의|当前协议
Both signatures verified against the same agreement hash.|동일한 합의 해시에 대해 양측 서명이 검증되었습니다.|双方签名均已针对同一协议哈希验证。
Awaiting bilateral signatures.|양측 서명 대기 중.|等待双方签名。
Only the signed price can be paid after delivery is checked.|납품 검증 후 서명된 가격만 지급할 수 있습니다.|交付检查后，仅可支付已签署的价格。
Agree and sign before any payment can be considered.|결제 전에 합의와 서명이 필요합니다.|考虑付款前必须达成协议并签署。
Inspect live proof|Live 증빙 확인|查看 Live 凭证
AGENTS STOPPED|에이전트 중지됨|智能体已停止
Model proposals cannot move funds. Your approval authorizes a private-EVM test escrow. Delivery uses the source-table worker.|모델 제안은 자금을 이동할 수 없습니다. 사용자 승인은 프라이빗 EVM 테스트 에스크로를 허용합니다. 납품은 원본 표 처리기로 수행됩니다.|模型提案不能移动资金。您的批准仅授权私有 EVM 测试托管。交付使用源表处理程序。
Live transaction timeline|Live 거래 타임라인|Live 交易时间线
TRANSACTION TIMELINE|거래 타임라인|交易时间线
{0} recorded events|기록된 사건 {0}건|已记录 {0} 个事件
Human mandate created|위임 권한 생성됨|人类授权已创建
In-flight request stopped|진행 중 요청 중지됨|进行中的请求已停止
Request not accepted · {0}|요청 거부됨 · {0}|请求未被接受 · {0}
Both signatures verified · Agreement fixed at {0}|양측 서명 검증 완료 · 합의 금액 {0} 확정|双方签名已验证 · 协议金额固定为 {0}
Signed agreement approved for this task|이 업무의 서명된 합의 승인됨|已批准此任务的已签协议
Authority revoked · Further proposals stopped|권한 철회 · 추가 제안 중지|授权已撤销 · 后续提案已停止
Is this agent allowed to spend it?|이 에이전트에게 지출 권한이 있나요?|该智能体是否获准支出？
The model response was incomplete. No offer was accepted. Try the request again or choose another agent.|모델 응답이 완전하지 않습니다. 수락된 제안은 없습니다. 다시 요청하거나 다른 에이전트를 선택하세요.|模型响应不完整，未接受任何报价。请重试或选择其他智能体。
The proposal exceeds your spending authority. Continue negotiating within your mandate.|제안이 지출 권한을 초과합니다. 위임 범위 내에서 협상하세요.|提案超出支出授权，请在授权范围内继续协商。
The proposal did not satisfy this seller’s policy. Ask for revised terms or choose another agent.|제안이 판매자 정책을 충족하지 못했습니다. 조건 수정을 요청하거나 다른 에이전트를 선택하세요.|提案不符合该卖方规则。请要求修改条款或选择其他智能体。
The proposal changed required coverage or delivery. Ask for terms that preserve the mandate.|제안이 필요한 범위나 납품 조건을 변경했습니다. 위임 내용을 유지하는 조건을 요청하세요.|提案改变了所需范围或交付条件。请要求保留授权内容的条款。
The agent changed the terms while accepting. Ask for a consistent proposal.|수락 과정에서 에이전트가 조건을 변경했습니다. 일관된 제안을 요청하세요.|智能体在接受时改变了条款，请要求一致的提案。
The response did not follow the negotiation format. Retry this step.|응답이 협상 형식을 따르지 않았습니다. 이 단계를 다시 시도하세요.|回应不符合协商格式，请重试此步骤。
The request did not finish. Refresh the saved state before retrying.|요청이 완료되지 않았습니다. 저장된 상태를 새로고침한 후 다시 시도하세요.|请求未完成，请刷新保存的状态后重试。
The response could not be accepted. Refresh the saved state, then retry or choose another agent.|응답을 수락할 수 없습니다. 상태를 새로고침한 뒤 다시 시도하거나 다른 에이전트를 선택하세요.|无法接受该回应。请刷新保存的状态，然后重试或选择其他智能体。
Edit your task|업무 수정|编辑任务
What needs to get done?|어떤 업무가 필요한가요?|需要完成什么任务？
Set the work and the limits. You approve every payment.|업무와 한도를 정하세요. 모든 결제는 직접 승인합니다.|设定任务与限额，每笔付款由您批准。
Task name|업무 이름|任务名称
e.g. Quarterly CAPEX research|예: 분기별 CAPEX 조사|例如：季度 CAPEX 研究
Work brief|업무 설명|工作说明
Describe the data you need and what a good result looks like.|필요한 데이터와 원하는 결과를 설명하세요.|描述所需数据与预期结果。
Supported workflow: normalize and validate source-linked quarterly CAPEX tables.|지원 업무: 출처가 연결된 분기별 CAPEX 표 정규화 및 검증.|支持的流程：规范化并验证关联来源的季度 CAPEX 表。
Bring your source table|원본 표를 가져오세요|导入您的源表
{0} rows · stored on this computer|{0}행 · 이 컴퓨터에 저장됨|{0} 行 · 保存在此电脑中
CSV or JSON · up to 1 MB · 2025–2026 quarters|CSV 또는 JSON · 최대 1 MB · 2025–2026년 분기|CSV 或 JSON · 最大 1 MB · 2025–2026 年季度
Replace file|파일 교체|替换文件
Choose a file|파일 선택|选择文件
Download CSV template|CSV 양식 다운로드|下载 CSV 模板
Paste CSV or JSON instead|CSV 또는 JSON 붙여넣기|粘贴 CSV 或 JSON
Source table|원본 표|源表
Use pasted table|붙여넣은 표 사용|使用粘贴的表格
Required columns|필수 열|必填列
Use finite, non-negative values and HTTP(S) source URLs. This workspace processes tables; it does not parse arbitrary PDFs.|유한한 0 이상의 값과 HTTP(S) 출처 URL을 사용하세요. 이 작업 공간은 표를 처리하며 임의의 PDF를 파싱하지 않습니다.|请使用有限非负数值和 HTTP(S) 来源网址。此工作区处理表格，不解析任意 PDF。
Task budget|업무 예산|任务预算
Per-deal limit|거래당 한도|每笔限额
Delivery window|납품 시간|交付时限
Test units have no cash value. In this private EVM, 1 unit = 1 gwei of a local test asset. No purchase or currency conversion.|테스트 단위에는 현금 가치가 없습니다. 이 프라이빗 EVM에서 1단위 = 로컬 테스트 자산 1 gwei입니다. 실제 구매나 환전은 없습니다.|测试单位没有现金价值。在此私有 EVM 中，1 单位 = 本地测试资产的 1 gwei。不涉及购买或货币兑换。
Your limits apply before funds move.|자금 이동 전에 한도가 적용됩니다.|资金移动前先校验限额。
Save changes|변경사항 저장|保存更改
Create task|업무 생성|创建任务
Company|회사|公司
Quarter|분기|季度
Source|출처|来源
View source|출처 보기|查看来源
Missing source|출처 누락|缺少来源
Showing {0} of {1} rows. Export the full result below.|{1}행 중 {0}행 표시. 아래에서 전체 결과를 내보내세요.|显示 {1} 行中的 {0} 行。请在下方导出完整结果。
READY TO RUN|실행 준비 완료|已准备好执行
Give {0} the go-ahead.|{0}의 실행을 승인하세요.|批准 {0} 执行。
Your funds are locked. The worker will process your actual source table.|자금이 예치되었습니다. 처리기가 실제 원본 표를 처리합니다.|资金已锁定，处理程序将处理您的实际源表。
Read the source|원본 읽기|读取来源
Normalize the data|데이터 정규화|规范化数据
Clean company names, numeric values, quarters and currencies.|회사명·수치·분기·통화를 정리합니다.|清理公司名称、数值、季度和币种。
Check every output row|모든 결과 행 검사|检查每一行输出
Compare values and source URLs with your original input.|원본 입력과 값 및 출처 URL을 비교합니다.|将数值与来源网址和原始输入进行比较。
Rule-based local worker. This processes your data without calling an external model.|규칙 기반 로컬 처리기입니다. 외부 모델 호출 없이 데이터를 처리합니다.|基于规则的本地处理程序，无需调用外部模型即可处理数据。
Cancel & refund|취소 및 환불|取消并退款
Run worker|처리기 실행|运行处理程序
WHO DOES WHAT|역할 안내|角色分工
Clear roles. Visible work.|명확한 역할, 보이는 업무.|清晰的角色，可见的工作。
Guided Demo uses deterministic workers. Live Agents uses actual Kiln calls with isolated buyer and seller policies. These are operator-owned agent roles, not independent suppliers.|가이드 데모는 규칙 기반 처리기를 사용합니다. Live 에이전트는 구매자와 판매자의 정책을 분리해 실제 Kiln을 호출합니다. 이들은 독립 공급업체가 아닌 운영자 소유의 에이전트 역할입니다.|引导演示使用确定性处理程序。Live 智能体使用真实 Kiln 调用，买卖双方规则相互隔离。这些是运营方拥有的智能体角色，并非独立供应商。
Turns your brief, selected offer and counteroffer into an agreement. Your approval is required before funds move.|업무 설명·선택한 제안·역제안을 합의로 만듭니다. 자금 이동 전 사용자 승인이 필요합니다.|将任务说明、选定报价和还价转为协议，资金移动前需要您的批准。
Your authority|나의 권한|您的授权
Price the task by row count, normalize the uploaded table, preserve references and return inspectable data.|행 수로 가격을 정하고 업로드된 표를 정규화하며 출처를 보존해 검사 가능한 데이터를 반환합니다.|按行数报价，规范化上传的表格，保留引用并返回可检查的数据。
Guided workers / Live model roles|데모 처리기 / Live 모델 역할|演示处理程序 / Live 模型角色
Policy & escrow|정책 및 에스크로|规则与托管
The workspace checks limits, source agreement and the exact invoice. The local contract executes escrow and settlement.|작업 공간이 한도·출처 합의·정확한 청구를 검사합니다. 로컬 컨트랙트가 에스크로와 정산을 실행합니다.|工作区检查限额、来源约定和精确账单。本地合约执行托管与结算。
Trusted controller|신뢰된 제어기|可信控制器
Real work, with explicit boundaries|명확한 범위의 실제 업무|边界明确的真实工作
Upload CSV or JSON, run a worker, review and export the output. Settlement uses a private EVM and test balances. The controller is trusted; the contract does not independently verify external facts. Public Sepolia evidence is a separate historical run.|CSV 또는 JSON을 업로드하고 처리기를 실행해 결과를 검토·내보내세요. 정산은 프라이빗 EVM과 테스트 잔액을 사용합니다. 제어기를 신뢰하며 컨트랙트가 외부 사실을 독립적으로 검증하지는 않습니다. 공개 Sepolia 증빙은 별도의 과거 실행입니다.|上传 CSV 或 JSON，运行处理程序并检查、导出结果。结算使用私有 EVM 和测试余额。控制器受信任，合约不独立验证外部事实。公开 Sepolia 证据来自独立的历史运行。
TRANSACTION RECOVERY|거래 복구|交易恢复
Confirm this transaction.|이 거래를 확인하세요.|确认此交易。
The previous request did not finish. Recheck the same recorded transaction to continue this task.|이전 요청이 완료되지 않았습니다. 같은 기록 거래를 다시 확인해 업무를 계속하세요.|上次请求未完成。请重新检查同一笔已记录交易以继续任务。
Your existing deal stays attached.|기존 거래는 유지됩니다.|现有交易保持关联。
Retry confirmation|다시 확인|重试确认
ROW EVIDENCE|행별 증거|行级证据
Source value|원본 값|源值
Delivered value|납품 값|交付值
No source URL provided.|출처 URL이 없습니다.|未提供来源网址。
Open original source|원본 출처 열기|打开原始来源
A preserved citation is not an independent certification of the source's accuracy.|보존된 인용은 출처 정확성에 대한 독립적인 인증이 아닙니다.|保留的引用并非对来源准确性的独立认证。
SELLER DELIVERY|판매자 납품|卖方交付
Inspect or replace the result|결과 확인 또는 교체|检查或替换结果
Changing a value or removing a citation runs the same acceptance checks again.|값 변경이나 인용 삭제 시 같은 검수 절차를 다시 실행합니다.|更改数值或移除引用后，会重新执行相同的验收检查。
Delivery JSON|납품 JSON|交付 JSON
Validate replacement|교체 결과 검증|验证替换结果
AGREEMENT ENFORCEMENT FOR AGENTS|에이전트 합의 이행 검증|智能体协议执行校验
Give agents room to negotiate.|에이전트가 협상하도록 맡기세요.|让智能体自主协商。
Keep every payment inside the deal.|결제는 합의 범위 안에서만.|每笔付款都遵守协议。
Run the demo|데모 실행|运行演示
See public proof|공개 증빙 보기|查看公开凭证
3 minutes · You make the decisions · No real funds|3분 · 직접 결정 · 실제 자금 없음|3 分钟 · 由您决策 · 无真实资金
Authority sets the boundary.|권한이 범위를 정합니다.|授权设定边界。
Can this agent spend 35 when its limit is 30?|한도가 30인 에이전트가 35를 쓸 수 있을까요?|限额为 30 的智能体能支出 35 吗？
Agreement sets the payment.|합의가 지급액을 정합니다.|协议决定付款金额。
Can it bill 25 when both sides agreed to 20?|양측이 20에 합의했는데 25를 청구할 수 있을까요?|双方约定 20 后，还能收取 25 吗？
A DEAL, PROTECTED|보호받는 거래|受保护的交易
Illustrative example|설명용 예시|说明示例
Research agent|조사 에이전트|研究智能体
Four CAPEX records. Sources included.|출처가 포함된 CAPEX 기록 4개.|4 条 CAPEX 记录，包含来源。
I can do that for|가능한 가격은|可接受的价格是
Same scope. Can we agree on|같은 범위로 다음 금액에 합의할까요?|范围不变，能否约定为
AGREED PRICE|합의 가격|约定价格
Terms accepted|조건 수락됨|条款已接受
AGREEMENT GATE|합의 검증|协议校验
The budget allowed it. The agreement did not.|예산은 허용했지만 합의는 허용하지 않았습니다.|预算允许，但协议不允许。
Pause illustration|예시 애니메이션 정지|暂停示意动画
Play illustration|예시 애니메이션 재생|播放示意动画
01 / HUMAN|01 / 사람|01 / 人类
02 / AGENTS|02 / 에이전트|02 / 智能体
03 / ACCORD|03 / ACCORD|03 / ACCORD
Set the authority|권한 설정|设定授权
Choose the budget and the limit per deal.|예산과 거래당 한도를 정하세요.|设定预算与每笔限额。
Negotiate the terms|조건 협상|协商条款
Watch offers, counteroffers and acceptance.|제안·역제안·수락 과정을 확인하세요.|观察报价、还价和接受过程。
Enforce the agreement|합의 이행 검증|执行协议
Lock the deal. Stop any payment that differs.|합의를 확정하고 다른 금액의 결제를 막습니다.|锁定协议，拦截不一致的付款。
ACCORD INTERCEPTED|ACCORD가 차단했습니다|ACCORD 已拦截
Protection worked|보호 작동|防护已生效
This offer exceeds your authority.|제안이 위임된 권한을 초과합니다.|该报价超出授权范围。
Allowed to spend it. Never agreed to it.|지출 한도 이내지만 합의한 금액은 아닙니다.|支出额度允许，但从未约定。
This invoice exceeds your authority and agreement.|청구가 권한과 합의 금액을 모두 초과합니다.|该账单同时超出授权与协议金额。
REQUEST|요청|请求
INVOICE|청구|账单
LIMIT|한도|限额
AGREEMENT|합의|协议
TRANSACTION PREVENTED|거래 차단|交易已阻止
PAYMENT BLOCKED|결제 차단|付款已拦截
Stopped before signing. Your spending authority stays intact.|서명 전에 중지되었습니다. 지출 권한은 그대로 보존됩니다.|签名前已停止，支出授权保持完整。
The invoice fits your budget. It does not match the agreed price.|예산 이내의 청구지만 합의 가격과 다릅니다.|账单在预算内，但与约定价格不符。
Both gates protect this payment. The invoice exceeds your limit and differs from the agreed price.|두 검증이 결제를 보호합니다. 청구가 한도를 초과하며 합의 가격과도 다릅니다.|两道校验共同保护付款。账单超出限额，且与约定价格不同。
No signature|서명 없음|无签名
No escrow|에스크로 없음|无托管
No funds moved|자금 이동 없음|无资金转移
No payment signed|결제 서명 없음|无付款签名
Escrow stays locked|에스크로 잠금 유지|托管保持锁定
Seller paid 0|판매자 지급 0|卖方收款 0
Negotiate with Atlas|Atlas와 협상|与 Atlas 协商
Request the agreed invoice · {0}|합의한 청구 요청 · {0}|请求约定账单 · {0}
A SEAT FOR EVERY SIDE OF THE DEAL|거래의 모든 참여자를 한곳에|交易各方齐聚一处
Your next agreement starts here.|새로운 합의가 여기서 시작됩니다.|您的下一份协议从这里开始。
Set the work and the spending authority.|업무와 지출 권한을 정하세요.|设定任务与支出授权。
Then follow the proposals, protection and payment in one room.|한 화면에서 제안·보호·결제를 확인하세요.|在同一个交易室跟进提案、防护与付款。
Start the guided deal|가이드 거래 시작|开始引导交易
Guided Demo · Deterministic agent simulation · No real money|가이드 데모 · 규칙 기반 에이전트 시뮬레이션 · 실제 자금 없음|引导演示 · 确定性智能体模拟 · 无真实资金
AGREEMENT HISTORY|합의 내역|协议历史
Every deal has a record.|모든 거래에는 기록이 남습니다.|每笔交易都有记录。
Reopen a deal to inspect its decisions, output and proof.|거래를 다시 열어 결정·결과·증빙을 확인하세요.|重新打开交易以查看决策、结果与凭证。
No agreements yet.|아직 합의된 거래가 없습니다.|尚无协议。
Make your first deal|첫 거래 시작|开始首笔交易
Delivery & payment|납품 및 결제|交付与付款
DEMO · Deterministic simulation|데모 · 규칙 기반 시뮬레이션|演示 · 确定性模拟
LIVE · Kiln negotiation / local delivery|LIVE · Kiln 협상 / 로컬 납품|LIVE · Kiln 协商 / 本地交付
AGENT DEAL ROOM / {0}|에이전트 거래실 / {0}|智能体交易室 / {0}
YOUR MANDATE IS READY|위임 권한 준비 완료|授权已就绪
Let the agents make their case.|에이전트의 제안을 받아보세요.|让智能体提出方案。
Sources required|출처 필수|需要来源
{0} CAPEX records|CAPEX 기록 {0}개|{0} 条 CAPEX 记录
{0} min delivery|납품 {0}분|{0} 分钟交付
Send request to all agents|모든 에이전트에 요청|向所有智能体发送请求
Edit mandate|위임 수정|编辑授权
Your counteroffer|나의 역제안|您的还价
Counteroffer in test units|테스트 단위 역제안 금액|以测试单位计的还价
Send counteroffer|역제안 보내기|发送还价
Accept {0}|{0} 수락|接受 {0}
Approve agreement & lock {0}|합의 승인 및 {0} 예치|批准协议并托管 {0}
PAID AS AGREED|합의대로 지급 완료|已按约定付款
The agreement became the payment.|합의한 대로 결제되었습니다.|付款完全遵循协议。
Your locked funds came back.|예치된 자금이 반환되었습니다.|托管资金已退回。
This deal is closed.|거래가 종료되었습니다.|此交易已关闭。
{0} test units paid once to {1}.|{1}에게 테스트 단위 {0}을 1회 지급했습니다.|已向 {1} 支付 {0} 个测试单位，仅支付一次。
{0} test units returned to the buyer.|구매자에게 테스트 단위 {0} 반환 완료.|已向买方退回 {0} 个测试单位。
No funds moved.|자금 이동 없음.|无资金转移。
Start another guided deal|다른 가이드 거래 시작|开始另一笔引导交易
No seller selected|선택된 판매자 없음|尚未选择卖方
`;
const runtimeRows = `
Ready to negotiate|협상 준비 완료|已准备好协商
Confirm funding|입금 확인|确认注资
Agreement locked|합의 확정|协议已锁定
Review delivery|납품 검토|审核交付
Confirm payment|지급 확인|确认付款
Confirm refund|환불 확인|确认退款
Paid as agreed|합의대로 지급됨|已按约定付款
Refunded|환불됨|已退款
Cancelled|취소됨|已取消
Brief|업무 설명|任务说明
Agreement|합의|协议
Work|업무|工作
Review|검토|审核
Not created|미생성|未创建
Request|요청|请求
Offer|제안|报价
Counter|역제안|还价
Accept|수락|接受
Revision|수정 제안|修订报价
Verification|검증|验证
Agreement locked|합의 확정|协议已锁定
Amount + delivery matched|금액 + 납품 일치|金额与交付一致
Committed terms|확정된 조건|已承诺条款
Your mandate|나의 위임|您的授权
Reliable coverage|신뢰할 수 있는 범위|可靠的覆盖范围
Speed & margin|속도와 마진|速度与利润
Premium research|프리미엄 조사|优质研究
Best price. Referenced sources. Within your authority.|최적 가격, 검증 가능한 출처, 위임된 권한 안에서.|最优价格、可引用来源、授权范围之内。
Private goals.|비공개 목표.|私有目标。
Public proposals.|공개 제안.|公开提案。
One enforceable deal.|이행 가능한 하나의 합의.|一份可执行的协议。
Agent negotiation|에이전트 협상|智能体协商
Test units · no cash value|테스트 단위 · 현금 가치 없음|测试单位 · 无现金价值
Is this the payment both sides agreed?|양측이 합의한 결제인가요?|这是双方约定的付款吗？
Stop agent|에이전트 중지|停止智能体
Authority revoked|권한 철회됨|授权已撤销
PROPOSED TERMS|제안된 조건|提议条款
AGENT STOPPED|에이전트 중지됨|智能体已停止
Paid to seller|판매자 지급|已支付给卖方
Checks failed|검사 실패|检查失败
Checks passed|검사 통과|检查通过
Review required|검토 필요|需要审核
Failed|실패|失败
Source references required|출처 참조 필수|需要来源引用
ACCORD · AGREEMENT MATCHED|ACCORD · 합의 일치|ACCORD · 协议一致
ACCORD · AGREEMENT LOCKED|ACCORD · 합의 확정|ACCORD · 协议已锁定
The corrected invoice matches the locked agreement.|정정된 청구가 확정된 합의와 일치합니다.|更正后的账单与锁定协议一致。
DELIVERED BY {0}|납품: {0}|交付方：{0}
Work you can inspect.|직접 확인할 수 있는 결과.|可供检查的工作成果。
Inspect {0} acceptance checks|검수 항목 {0}개 확인|查看 {0} 项验收检查
Compared with the supplied input; citations are not independent fact certification.|제공된 입력과 비교한 결과입니다. 인용은 독립적인 사실 인증이 아닙니다.|已与提供的输入比较；引用并非独立的事实认证。
Replace delivery|납품 결과 교체|替换交付结果
Check invoice|청구 검증|检查账单
Reject & refund|거부 및 환불|拒绝并退款
Download JSON|JSON 다운로드|下载 JSON
Download CSV|CSV 다운로드|下载 CSV
Funds secured. Your agreed terms stay fixed.|자금이 확보되었습니다. 합의 조건은 고정됩니다.|资金已保全，约定条款保持不变。
GUIDED DEMO · DEMO ASSIST|가이드 데모 · 시연 도우미|引导演示 · 演示助手
Send the request. Compare three agents with different priorities.|요청을 보내고 우선순위가 다른 에이전트 3개의 제안을 비교하세요.|发送请求，比较优先级不同的三个智能体。
Protection worked. Negotiate with Atlas inside your authority.|보호가 작동했습니다. 위임 범위 안에서 Atlas와 협상하세요.|防护已生效，请在授权范围内与 Atlas 协商。
Try 18. Atlas can propose 20. Accept the terms before funding.|18을 제안해 보세요. Atlas는 20을 제안할 수 있습니다. 입금 전에 조건을 수락하세요.|尝试提出 18，Atlas 可以还价 20。请在注资前接受条款。
Run the worker to inspect the delivered data and its invoice.|처리기를 실행해 납품 데이터와 청구를 확인하세요.|运行处理程序以检查交付数据和账单。
The corrected bill matches. Approve it or reject the work.|정정된 청구가 일치합니다. 결제하거나 납품을 거부하세요.|更正后的账单一致。请选择批准或拒绝交付。
25 is within the budget, but differs from the agreed 20. The Agreement Gate stops payment.|25는 예산 이내지만 합의 금액 20과 다릅니다. 합의 검증이 결제를 막습니다.|25 在预算内，但与约定的 20 不符。协议校验会拦截付款。
The exact agreement was paid. Open the proof to inspect the receipt.|합의 금액이 정확히 지급되었습니다. 증빙을 열어 영수증을 확인하세요.|已准确支付约定金额。打开凭证以检查回执。
Inspect the deal state and choose the next action.|거래 상태를 확인하고 다음 동작을 선택하세요.|检查交易状态并选择下一步操作。
Creating your mandate and requesting offers…|위임 권한 생성 및 제안 요청 중…|正在创建授权并请求报价…
Buyer and Atlas are exchanging terms…|구매 에이전트와 Atlas가 조건을 협상 중…|采购智能体与 Atlas 正在协商条款…
Confirming signatures, escrow and delivery…|서명·에스크로·납품 확인 중…|正在确认签名、托管与交付…
Checking the corrected invoice and confirming settlement…|정정된 청구 검증 및 정산 확인 중…|正在检查更正账单并确认结算…
Verifying the actual receipt…|실제 영수증 검증 중…|正在验证实际回执…
Delegating your mandate…|권한 위임 중…|正在委派授权…
Seller is preparing an offer…|판매 에이전트가 제안 준비 중…|销售智能体正在准备报价…
Buyer is comparing the terms…|구매 에이전트가 조건 비교 중…|采购智能体正在比较条款…
Seller is evaluating the counteroffer…|판매 에이전트가 역제안 검토 중…|销售智能体正在评估还价…
Verifying terms and creating both signatures…|조건 검증 및 양측 서명 생성 중…|正在验证条款并创建双方签名…
Funding the approved agreement and executing the source-table worker…|승인된 합의 입금 및 원본 표 처리기 실행 중…|正在为已批准协议注资并执行源表处理程序…
Checking the actual invoice before settlement…|정산 전 실제 청구 확인 중…|正在结算前检查实际账单…
Reading the current transaction…|현재 거래 확인 중…|正在读取当前交易…
Requesting the three deterministic offers…|규칙 기반 제안 3개 요청 중…|正在请求三个确定性报价…
Buyer is choosing Atlas…|구매 에이전트가 Atlas 선택 중…|采购智能体正在选择 Atlas…
Confirming both signatures and funding escrow…|양측 서명 확인 및 에스크로 입금 중…|正在确认双方签名并向托管注资…
Reading the source table and validating delivery…|원본 표 읽기 및 납품 검증 중…|正在读取源表并验证交付…
Checking the corrected invoice against the signed deal…|서명된 합의와 정정 청구 대조 중…|正在核对更正账单与已签协议…
Confirming the private-EVM settlement…|프라이빗 EVM 정산 확인 중…|正在确认私有 EVM 结算…
Sending your counteroffer…|역제안 전송 중…|正在发送还价…
Checking the invoice against the agreement…|합의와 청구 대조 중…|正在核对账单与协议…
Saving your task and source table…|업무 및 원본 표 저장 중…|正在保存任务与源表…
Updating your brief…|업무 설명 수정 중…|正在更新任务说明…
Saving your spending policy…|지출 정책 저장 중…|正在保存支出规则…
Selecting seller…|판매자 선택 중…|正在选择卖方…
Sending your message to Kiln…|Kiln에 메시지 전송 중…|正在向 Kiln 发送消息…
Applying your instruction…|지시 적용 중…|正在执行指令…
Opening a new purchase…|새 구매 여는 중…|正在打开新采购…
Applying your next transaction decision…|다음 거래 결정 적용 중…|正在执行您的下一项交易决定…
Kiln is reading the brief and the seller’s private policy…|Kiln이 업무 설명과 판매자의 비공개 정책을 읽는 중…|Kiln 正在读取任务说明与卖方私有规则…
Buyer is comparing the public terms with your mandate…|구매 에이전트가 공개 조건과 위임 내용 대조 중…|采购智能体正在核对公开条款与授权…
The seller is evaluating the counteroffer against its own policy…|판매자가 자신의 정책에 따라 역제안 검토 중…|卖方正在根据自身规则评估还价…
Checking both policies and creating two signatures…|양측 정책 검사 및 서명 2개 생성 중…|正在检查双方规则并创建两个签名…
Binding the live agreement to your task and funding its escrow…|Live 합의를 업무에 연결하고 에스크로 입금 중…|正在将 Live 协议绑定到任务并向托管注资…
Updating the live negotiation…|Live 협상 갱신 중…|正在更新 Live 协商…
Preparing your mandate…|위임 준비 중…|正在准备授权…
Opening negotiations with Atlas…|Atlas와 협상 시작 중…|正在开始与 Atlas 的协商…
Confirming the revised terms…|수정된 조건 확인 중…|正在确认修订条款…
Checking the live agent service…|Live 에이전트 서비스 확인 중…|正在检查 Live 智能体服务…
Preparing your task…|업무 준비 중…|正在准备任务…
Checking the corrected invoice…|정정된 청구 확인 중…|正在检查更正账单…
Validating the replacement delivery…|교체된 납품 결과 검증 중…|正在验证替换后的交付…
Preparing the task receipt…|업무 영수증 준비 중…|正在准备任务回执…
Verifying the receipt against the local chain…|로컬 체인과 영수증 대조 검증 중…|正在根据本地链验证回执…
Revoking future spending authority for this task…|이 업무의 향후 지출 권한 철회 중…|正在撤销此任务后续支出授权…
Reading your brief and calculating offers…|업무 설명 읽기 및 제안 계산 중…|正在读取任务说明并计算报价…
Checking authority, then confirming the local escrow transaction…|권한 검사 및 로컬 에스크로 거래 확인 중…|正在检查授权并确认本地托管交易…
Reading source rows, normalizing the table and checking each output…|원본 행 읽기·정규화·결과 검사 중…|正在读取源行、规范化表格并检查输出…
Rechecking the delivery and invoice, then confirming the local payment…|납품·청구 재검사 및 로컬 결제 확인 중…|正在复查交付与账单并确认本地付款…
Submitting and confirming your local refund…|로컬 환불 제출 및 확인 중…|正在提交并确认本地退款…
Opening task…|업무 여는 중…|正在打开任务…
Selecting this offer…|제안 선택 중…|正在选择此报价…
Enter a message for the agents.|에이전트에게 보낼 메시지를 입력하세요.|请输入给智能体的消息。
Enter a positive whole counteroffer.|0보다 큰 정수로 역제안 금액을 입력하세요.|请输入正整数还价金额。
Use positive whole amounts. Max per deal cannot exceed total budget.|금액은 양의 정수여야 합니다. 거래당 한도는 총예산을 초과할 수 없습니다.|金额必须为正整数，每笔限额不能超过总预算。
Describe the task in at least 10 characters.|업무 설명을 10자 이상 입력하세요.|请至少输入 10 个字符的任务说明。
Describe the task in at least 10 characters, or use Delegate task for the sample.|업무 설명을 10자 이상 입력하거나 업무 위임 버튼으로 샘플을 사용하세요.|请至少输入 10 个字符的任务说明，或点击委派任务使用示例。
Choose a file smaller than 1 MB.|1 MB 미만의 파일을 선택하세요.|请选择小于 1 MB 的文件。
Choose a source file, or use the sample task.|원본 파일을 선택하거나 샘플 업무를 사용하세요.|请选择源文件或使用示例任务。
Use a CSV or JSON file smaller than 1 MB.|1 MB 미만의 CSV 또는 JSON 파일을 사용하세요.|请使用小于 1 MB 的 CSV 或 JSON 文件。
Paste a table smaller than 1 MB.|1 MB 미만의 표를 붙여넣으세요.|请粘贴小于 1 MB 的表格。
The JSON is not valid. Upload an array of data rows.|유효하지 않은 JSON입니다. 데이터 행 배열을 업로드하세요.|JSON 无效，请上传数据行数组。
A CSV field has an unclosed quote.|CSV 필드에 닫히지 않은 따옴표가 있습니다.|CSV 字段存在未闭合的引号。
Check the quotes in your CSV.|CSV의 따옴표를 확인하세요.|请检查 CSV 中的引号。
CSV column names must be unique.|CSV 열 이름은 중복될 수 없습니다.|CSV 列名必须唯一。
Each CSV row must have the same number of columns as the header.|각 CSV 행의 열 수는 헤더와 같아야 합니다.|每行 CSV 的列数必须与表头一致。
Each row needs company, quarter, capex, currency and source_url.|각 행에 company, quarter, capex, currency, source_url이 필요합니다.|每行需要 company、quarter、capex、currency 和 source_url。
Include company, quarter, capex, currency and source_url columns.|company, quarter, capex, currency, source_url 열을 포함하세요.|请包含 company、quarter、capex、currency 和 source_url 列。
Provide between 1 and 1,000 data rows.|데이터를 1~1,000행 제공하세요.|请提供 1 至 1,000 行数据。
Use text for names, quarters, currencies and source URLs, and a nonempty numeric CAPEX value.|이름·분기·통화·출처 URL은 텍스트로, CAPEX는 비어 있지 않은 숫자로 입력하세요.|名称、季度、币种和来源网址请使用文本，CAPEX 必须为非空数值。
Request quotes before negotiating.|협상 전에 견적을 요청하세요.|协商前请先请求报价。
Select a seller before approving this Guided deal.|가이드 거래 승인 전에 판매자를 선택하세요.|批准引导交易前请先选择卖方。
Authority is stopped. Start a new story to delegate again.|권한이 중지되었습니다. 새 거래를 시작해 다시 위임하세요.|授权已停止，请开始新交易以重新委派。
Settlement is not confirmed. Inspect the current deal.|정산이 확인되지 않았습니다. 현재 거래를 확인하세요.|结算尚未确认，请检查当前交易。
No negotiation turn is available. Inspect the current agreement.|진행할 협상 차례가 없습니다. 현재 합의를 확인하세요.|没有可继续的协商回合，请检查当前协议。
Use a Guided sample for this story. Live and custom deals remain in Detailed Deal Room.|이 흐름에서는 가이드 샘플을 사용하세요. Live 및 사용자 거래는 상세 거래실에 유지됩니다.|此流程请使用引导示例。Live 与自定义交易保留在详细交易室。
Invalid or incomplete structured response|잘못되었거나 불완전한 구조화 응답|结构化回应无效或不完整
Outside authority|위임 권한 초과|超出授权
Outside seller policy|판매자 정책 범위 초과|超出卖方规则
Required scope changed|필수 범위 변경됨|所需范围已改变
Requested offers|제안 요청됨|已请求报价
Brief updated|업무 설명 수정됨|任务说明已更新
Source data and spending limits saved in this browser.|원본 데이터와 지출 한도가 이 브라우저에 저장되었습니다.|源数据与支出限额已保存在此浏览器。
All-in fixed price, calculated by the local worker’s pricing rules.|로컬 처리기의 가격 규칙으로 계산한 전체 고정 가격입니다.|依据本地处理程序定价规则计算的一口价。
{0} source rows; {1} test USD per-deal limit.|원본 {0}행 · 거래당 한도 {1} 테스트 USD.|{0} 行源数据；每笔限额 {1} 测试 USD。
{0} source rows; {1} test units per-deal limit.|원본 {0}행 · 거래당 한도 {1} 테스트 단위.|{0} 行源数据；每笔限额 {1} 测试单位。
{0} offered {1} test USD|{0} 제안: {1} 테스트 USD|{0} 报价：{1} 测试 USD
{0} offered {1} test units|{0} 제안: {1} 테스트 단위|{0} 报价：{1} 测试单位
Sample offer blocked|샘플 제안 차단됨|示例报价已拦截
{0}: {1} test USD exceeds the {2} per-deal limit. Automatic sample check; no transaction was signed. Choose Atlas and negotiate {3}.|{0}: {1} 테스트 USD가 거래당 한도 {2}를 초과합니다. 자동 샘플 검증으로 서명된 거래는 없습니다. Atlas를 선택해 {3}에 협상하세요.|{0}：{1} 测试 USD 超出每笔限额 {2}。示例自动校验，未签署交易。请选择 Atlas 并协商至 {3}。
{0}: {1} test units exceeds the {2} per-deal limit. Automatic sample check; no transaction was signed. Choose Atlas and negotiate {3}.|{0}: {1} 테스트 단위가 거래당 한도 {2}를 초과합니다. 자동 샘플 검증으로 서명된 거래는 없습니다. Atlas를 선택해 {3}에 협상하세요.|{0}：{1} 测试单位超出每笔限额 {2}。示例自动校验，未签署交易。请选择 Atlas 并协商至 {3}。
Offer selected|제안 선택됨|已选择报价
{0} selected. Funds have not moved.|{0} 선택됨. 자금 이동은 없습니다.|已选择 {0}，资金尚未移动。
Counteroffer: {0} test USD|역제안: {0} 테스트 USD|还价：{0} 测试 USD
Counteroffer: {0} test units|역제안: {0} 테스트 단위|还价：{0} 测试单位
Revised offer: {0} test USD|수정 제안: {0} 테스트 USD|修订报价：{0} 测试 USD
Revised offer: {0} test units|수정 제안: {0} 테스트 단위|修订报价：{0} 测试单位
Requested an all-in fixed price.|전체 고정 가격을 요청했습니다.|已请求一口价。
I cannot accept {0} for the same scope. I can do {1}, with all {2} referenced rows.|같은 범위에 {0}는 수락할 수 없습니다. 출처가 있는 {2}행 전체를 {1}에 제공할 수 있습니다.|同样的范围无法接受 {0}。包含全部 {2} 行引用数据，可接受 {1}。
Counteroffer accepted|역제안 수락됨|还价已接受
{0} test USD for the complete task.|전체 업무 가격 {0} 테스트 USD.|完整任务价格为 {0} 测试 USD。
{0} test units for the complete task.|전체 업무 가격 {0} 테스트 단위.|完整任务价格为 {0} 测试单位。
Authority checks passed|권한 검사 통과|授权检查通过
{0} test USD fits both approved spending limits.|{0} 테스트 USD는 승인된 두 지출 한도 이내입니다.|{0} 测试 USD 同时符合两个已批准的支出限额。
{0} test units fits both approved spending limits.|{0} 테스트 단위는 승인된 두 지출 한도 이내입니다.|{0} 测试单位同时符合两个已批准的支出限额。
Funds locked in escrow|자금 에스크로 예치 완료|资金已锁定于托管
The escrow contract executed on this browser’s private EVM. No public funds were used.|이 브라우저의 프라이빗 EVM에서 에스크로 컨트랙트가 실행되었습니다. 공개 자금은 사용하지 않았습니다.|托管合约已在此浏览器的私有 EVM 执行，未使用公链资金。
Sample overcharge blocked|샘플 과다 청구 차단됨|示例多收费已拦截
Authored demo invoice: {0} test USD; agreement: {1}. Payment blocked by the application before signing. Escrow remains locked.|데모 청구: {0} 테스트 USD · 합의: {1}. 서명 전에 애플리케이션이 결제를 차단했습니다. 에스크로 잠금은 유지됩니다.|演示账单：{0} 测试 USD；协议：{1}。应用在签名前已拦截付款，托管保持锁定。
Authored demo invoice: {0} test units; agreement: {1}. Payment blocked by the application before signing. Escrow remains locked.|데모 청구: {0} 테스트 단위 · 합의: {1}. 서명 전에 애플리케이션이 결제를 차단했습니다. 에스크로 잠금은 유지됩니다.|演示账单：{0} 测试单位；协议：{1}。应用在签名前已拦截付款，托管保持锁定。
Worker completed the task|처리기 업무 완료|处理程序已完成任务
Read {0} rows, normalized fields and preserved citations and units.|{0}행을 읽고 필드를 정규화하며 인용과 단위를 보존했습니다.|已读取 {0} 行、规范化字段并保留引用与单位。
Delivery ready for review|납품 검토 준비 완료|交付已准备好审核
{0}/{1} checks passed. Inspect the output before paying.|검사 {1}개 중 {0}개 통과. 결제 전 결과를 확인하세요.|{1} 项检查中 {0} 项通过。付款前请检查输出。
Invoice matches the agreement|청구 금액이 합의와 일치|账单与协议一致
Invoice blocked|청구 차단됨|账单已拦截
{0} test USD requested; {1} test USD agreed. A spending limit does not authorize an overcharge.|청구 {0} 테스트 USD · 합의 {1} 테스트 USD. 지출 한도는 과다 청구를 승인하지 않습니다.|请求 {0} 测试 USD；约定 {1} 测试 USD。支出限额并不授权多收费。
{0} test units requested; {1} test units agreed. A spending limit does not authorize an overcharge.|청구 {0} 테스트 단위 · 합의 {1} 테스트 단위. 지출 한도는 과다 청구를 승인하지 않습니다.|请求 {0} 测试单位；约定 {1} 测试单位。支出限额并不授权多收费。
Payment confirmed|지급 확인 완료|付款已确认
Refund confirmed|환불 확인 완료|退款已确认
{0} test USD paid once to {1} on this browser’s private EVM.|이 브라우저의 프라이빗 EVM에서 {1}에게 {0} 테스트 USD를 1회 지급했습니다.|已在此浏览器的私有 EVM 向 {1} 支付 {0} 测试 USD，仅支付一次。
{0} test units paid once to {1} on this browser’s private EVM.|이 브라우저의 프라이빗 EVM에서 {1}에게 {0} 테스트 단위를 1회 지급했습니다.|已在此浏览器的私有 EVM 向 {1} 支付 {0} 测试单位，仅支付一次。
{0} test USD returned to the buyer on this browser’s private EVM.|이 브라우저의 프라이빗 EVM에서 구매자에게 {0} 테스트 USD를 반환했습니다.|已在此浏览器的私有 EVM 向买方退回 {0} 测试 USD。
Task authority revoked|업무 권한 철회됨|任务授权已撤销
New commitments disabled for this task. Existing funded work remains payable on its agreed terms; refunds require a separate decision. This is a local workspace control.|이 업무의 새 약정이 중단됩니다. 기존 예치 업무는 합의 조건에 따라 지급할 수 있으며 환불은 별도 결정이 필요합니다. 로컬 작업 공간 제어입니다.|此任务禁止新增承诺。已注资工作仍可按约定条款付款，退款需单独决定。这是本地工作区控制。
Delivery updated|납품 수정됨|交付已更新
All acceptance checks passed.|모든 검수 항목 통과.|所有验收检查均通过。
Validation failed. Payment remains blocked.|검증 실패. 결제는 계속 차단됩니다.|验证失败，付款仍被拦截。
Task cancelled|업무 취소됨|任务已取消
No funds were allocated.|배정된 자금이 없습니다.|未分配任何资金。
Task created|업무 생성됨|任务已创建
Live negotiation started|Live 협상 시작됨|Live 协商已开始
Kiln agents received the task brief. No funds moved.|Kiln 에이전트가 업무 설명을 받았습니다. 자금 이동은 없습니다.|Kiln 智能体已收到任务说明，资金未移动。
Both agents signed|양측 에이전트 서명 완료|双方智能体已签署
Human counteroffer|사용자 역제안|用户还价
Sent to Kiln|Kiln에 전송됨|已发送至 Kiln
Spending request blocked|지출 요청 차단됨|支出请求已拦截
{0} test USD exceeds your {1} per-deal limit. No transaction was signed. Negotiate within your existing authority.|{0} 테스트 USD가 거래당 한도 {1}를 초과합니다. 서명된 거래는 없습니다. 기존 권한 범위 내에서 협상하세요.|{0} 测试 USD 超出每笔限额 {1}。未签署交易，请在现有授权内协商。
{0} test USD exceeds your authority. No transaction was signed.|{0} 테스트 USD가 권한을 초과합니다. 서명된 거래는 없습니다.|{0} 测试 USD 超出授权，未签署交易。
`;
const validationRows = `
{0} AM|오전 {0}|上午 {0}
{0} PM|오후 {0}|下午 {0}
Set your policy, message real agents, and pay only what was agreed. Explore the guided demo or connect to Kiln. Test USD, no real funds.|정책을 정하고 실제 에이전트에게 요청하며 합의한 금액만 결제하세요. 가이드 데모 또는 Kiln 연결로 체험할 수 있습니다. 테스트 USD를 사용하며 실제 자금은 없습니다.|设定规则、向真实智能体发送消息，并仅支付约定金额。体验引导演示或连接 Kiln。使用测试 USD，不涉及真实资金。
ACCORD LOCK · DEALTRACE PUBLIC PROOF|ACCORD LOCK · DEALTRACE 공개 증빙|ACCORD LOCK · DEALTRACE 公开凭证
The same question. Public evidence.|같은 질문에, 공개된 증거로 답합니다.|同一个问题，用公开证据回答。
Did we pay what the agents agreed? This saved DealTrace run used Kiln / Qwen and Sepolia. Guided Demo uses authored worker rules and a private EVM. Live negotiations are new model calls, separate from this recording.|에이전트가 합의한 금액을 지급했나요? 이 저장된 DealTrace 실행은 Kiln / Qwen과 Sepolia를 사용했습니다. 가이드 데모는 작성된 처리 규칙과 프라이빗 EVM을 사용합니다. Live 협상은 이 기록과 별개의 새로운 모델 호출입니다.|是否按照智能体的约定付款？这份已保存的 DealTrace 运行使用了 Kiln / Qwen 和 Sepolia。引导演示使用预设处理规则与私有 EVM。Live 协商是新的模型调用，与此记录无关。
RECORDED {0} · NOT A NEW EXECUTION|기록일 {0} · 새로운 실행 아님|记录于 {0} · 并非新执行
Budget {0}. Agreed {1}. Invoice {2} rejected.|예산 {0}. 합의 {1}. 청구 {2} 차단.|预算 {0}，约定 {1}，账单 {2} 已拒绝。
Both agents signed the same deal. Even with valid seller and evaluator signatures, the contract rejected the higher invoice. The corrected {0} was settled and withdrawn.|양측 에이전트가 같은 거래에 서명했습니다. 유효한 판매자·평가자 서명이 있어도 컨트랙트는 과다 청구를 거부했습니다. 정정된 {0}만 정산·출금되었습니다.|双方智能体签署同一协议。即使卖方和评估者签名有效，合约仍拒绝更高账单。更正后的 {0} 已结算并提取。
Agreed & paid|합의 및 지급액|约定并支付
Invoice rejected|청구 거부됨|账单已拒绝
Public proof uses DEMO accounting units: 1 DEMO = 100 gwei of Sepolia test ETH. Browser demo uses 1 test unit = 1 local gwei. The economic amounts match; the networks and unit scales differ. Neither is a cash price. Gas is recorded separately.|공개 증빙은 DEMO 회계 단위를 사용합니다. 1 DEMO = Sepolia 테스트 ETH 100 gwei. 브라우저 데모는 1 테스트 단위 = 로컬 1 gwei입니다. 표현하는 거래 금액은 같지만 네트워크와 단위 크기는 다릅니다. 둘 다 현금 가격이 아니며 가스는 별도 기록합니다.|公开凭证使用 DEMO 记账单位：1 DEMO = 100 gwei 的 Sepolia 测试 ETH。浏览器演示中 1 测试单位 = 1 本地 gwei。表示的交易金额相同，但网络和单位比例不同，两者均非现金价格。Gas 单独记录。
open-mandate|권한 위임 기록|记录授权
fund|에스크로 입금|托管注资
release|판매자 지급|支付卖方
refund|환불|退款
overbill-blocked|과다 청구 차단|拦截多收费
settle|정산|结算
withdraw-seller|판매자 출금|卖方提现
CONFIRMED|확인됨 (CONFIRMED)|已确认 (CONFIRMED)
REVERTED|되돌림 (REVERTED)|已回退 (REVERTED)
PENDING|대기 중 (PENDING)|待处理 (PENDING)
VALID|유효 (VALID)|有效 (VALID)
Block {0}|블록 {0}|区块 {0}
{0} · Chain {1}|{0} · 체인 {1}|{0} · 链 {1}
{0} finalized checks|최종 확정 검사 {0}건|{0} 项最终确认检查
Recorded block {0}. Open the report to inspect the original checks.|기록 블록 {0}. 보고서를 열어 원본 검증을 확인하세요.|记录区块 {0}。请打开报告查看原始检查。
Where Kiln contributed|Kiln이 담당한 부분|Kiln 的作用
Three sellers → five Kiln calls → 22 to 20 negotiated → 25 invoice rejected → 20 settled on Sepolia.|판매자 3개 → Kiln 호출 5회 → 22에서 20으로 협상 → 청구 25 차단 → Sepolia에서 20 정산.|3 个卖方 → 5 次 Kiln 调用 → 从 22 协商至 20 → 拒绝账单 25 → 在 Sepolia 结算 20。
{0} actual API calls · {1} tokens · {2}. Offers and a counteroffer used inference; budgets, billing and chain verification used code.|실제 API 호출 {0}회 · 토큰 {1}개 · {2}. 제안과 역제안에는 추론을, 예산·청구·체인 검증에는 코드를 사용했습니다.|{0} 次真实 API 调用 · {1} 个 token · {2}。报价与还价使用推理，预算、账单和链上验证使用代码。
No NPU power telemetry was collected. Token counts are measured API usage, not measured energy savings. This evidence is a saved successful run; failed development attempts remain in the|NPU 전력 측정값은 수집하지 않았습니다. 토큰 수는 API 사용량이며 실측 에너지 절감량이 아닙니다. 저장된 성공 실행의 증빙이며 개발 중 실패한 시도도 다음 원장에 남습니다:|未采集 NPU 功耗遥测。Token 数是 API 用量，并非实测节能。这是保存的成功运行证据，开发中的失败尝试仍保留于
all-run usage ledger|전체 실행 사용량 원장|全部运行用量账本
What is guaranteed, and by whom?|무엇을 누가 보장하나요?|由谁保障哪些事项？
This browser:|이 브라우저:|此浏览器：
limit and invoice checks execute in application code before signing; the local escrow runs real bytecode. Its controller is trusted.|서명 전에 애플리케이션 코드가 한도와 청구를 검사하고, 로컬 에스크로가 실제 바이트코드를 실행합니다. 제어기는 신뢰 대상입니다.|签名前由应用代码检查限额与账单，本地托管运行真实字节码。控制器是信任对象。
Public DealTrace V2:|공개 DealTrace V2:|公开 DealTrace V2：
signed agreement amounts and human authority are checked on Sepolia. An evaluator is still trusted for delivery quality; the chain does not establish whether a CAPEX claim is true.|Sepolia에서 서명된 합의 금액과 사람의 권한을 검사합니다. 납품 품질은 평가자를 신뢰하며 체인이 CAPEX 내용의 진위를 입증하지 않습니다.|在 Sepolia 检查已签署金额与人类授权。交付质量仍依赖评估者，链本身不证明 CAPEX 内容的真实性。
DealTrace bundle|DealTrace 증빙 묶음|DealTrace 凭证包
Earlier escrow scenarios · separate historical amounts|이전 에스크로 시나리오 · 별도 과거 금액|早期托管场景 · 独立历史金额
These earlier runs cover refund, recovery and outcome-driven restrictions. They are not the 40 / 20 / 25 procurement run above.|이전 실행은 환불·복구·결과 기반 제한을 다룹니다. 위의 40 / 20 / 25 구매 실행과는 다릅니다.|这些早期运行涵盖退款、恢复和基于结果的限制，不是上方的 40 / 20 / 25 采购运行。
The public proof summary could not load. Open the original bundle below; no verification result is assumed.|공개 증빙 요약을 불러오지 못했습니다. 아래 원본 묶음을 여세요. 검증 결과를 임의로 가정하지 않습니다.|无法加载公开凭证摘要。请打开下方原始数据包，系统不会假定验证成功。
Procurement / seller-a|구매 / 판매자 A|采购 / 卖方 A
Procurement / seller-b|구매 / 판매자 B|采购 / 卖方 B
Procurement / seller-c|구매 / 판매자 C|采购 / 卖方 C
Procurement / buyer|구매 / 구매자|采购 / 买方
A quality-first worker that preserves the complete source metadata with every row.|각 행의 모든 출처 메타데이터를 보존하는 품질 우선 처리기.|优先保证质量、保留每行完整来源元数据的处理程序。
A speed-first worker that prioritizes short delivery windows and margin.|짧은 납품 시간과 마진을 우선하는 속도 중심 처리기.|优先考虑短交付时间和利润的速度型处理程序。
Normalize the table, preserve source references and compare every result with your input.|표를 정규화하고 출처를 보존하며 모든 결과를 입력과 비교합니다.|规范化表格、保留来源引用，并将所有结果与输入比较。
Source-aware data worker|출처를 보존하는 데이터 처리기|保留来源的数据处理程序
Spending authority|지출 권한|支出授权
Agreed amount|합의 금액|约定金额
Selected offer|선택한 제안|选定报价
Invoice rejected|청구 거부됨|账单已拒绝
STOP RECORDED|중지 기록됨|停止已记录
PAID · EXACT AGREEMENT|지급 완료 · 합의 금액 일치|已付款 · 与协议完全一致
AGREEMENT CONTROLS PAYMENT|합의가 결제를 제어합니다|协议控制付款
Worker proposes|처리기가 제안합니다|处理程序提出建议
Offer exceeds authority|제안이 권한 초과|报价超出授权
Agreement + delivery + invoice match|합의 + 납품 + 청구 일치|协议、交付与账单一致
Policy checks authority and agreement|정책이 권한과 합의를 검사합니다|规则检查授权与协议
No funds locked|예치된 자금 없음|无锁定资金
Task ID:|업무 ID:|任务 ID：
Recorded event|기록된 사건|已记录事件
Funding signatures: 0 · Seller payout: 0|입금 서명: 0 · 판매자 지급: 0|注资签名：0 · 卖方收款：0
Payout signatures: 0 · Seller payout: 0 · Existing escrow remains locked|지급 서명: 0 · 판매자 지급: 0 · 기존 에스크로 잠금 유지|付款签名：0 · 卖方收款：0 · 现有托管保持锁定
Live local workflow · authored worker rules · private EVM · test units. Kiln / Sepolia evidence is a separate recorded run.|실시간 로컬 흐름 · 작성된 처리 규칙 · 프라이빗 EVM · 테스트 단위. Kiln / Sepolia 증빙은 별도의 기록된 실행입니다.|实时本地流程 · 预设处理规则 · 私有 EVM · 测试单位。Kiln / Sepolia 证据来自独立的记录运行。
Message the live agents|Live 에이전트에게 메시지 보내기|向 Live 智能体发送消息
Message Buyer|구매 에이전트에게 메시지 보내기|向采购智能体发送消息
Message {0}|{0}에게 메시지 보내기|向 {0} 发送消息
Tell the agent what to negotiate. Your message goes to Kiln; your spending rules stay in force.|협상할 내용을 에이전트에게 알려주세요. 메시지는 Kiln으로 전송되며 지출 정책은 계속 적용됩니다.|告诉智能体协商什么。消息将发送至 Kiln，支出规则仍然有效。
Can you offer a lower price without reducing source coverage?|출처 범위를 줄이지 않고 가격을 낮출 수 있나요?|能否在不减少来源覆盖的情况下降低价格？
Send message|메시지 보내기|发送消息
Waiting for the actual Kiln response…|실제 Kiln 응답 대기 중…|正在等待真实 Kiln 回应…
Agents stopped. Start a new negotiation to send messages.|에이전트가 중지되었습니다. 메시지를 보내려면 새 협상을 시작하세요.|智能体已停止，请开始新协商以发送消息。
Agreement locked. Approve the signed deal or start a new negotiation.|합의가 확정되었습니다. 서명된 거래를 승인하거나 새 협상을 시작하세요.|协议已锁定，请批准已签协议或开始新协商。
A model request is running. Wait, refresh, or stop the agents.|모델 요청 처리 중입니다. 기다리거나 상태를 새로고침하거나 에이전트를 중지하세요.|模型请求正在执行。请等待、刷新或停止智能体。
All 8 model calls have been used. Start a new negotiation.|모델 호출 8회를 모두 사용했습니다. 새 협상을 시작하세요.|8 次模型调用已用完，请开始新协商。
Connect the live service with available calls to send a message.|메시지를 보내려면 호출 잔여량이 있는 Live 서비스에 연결하세요.|请连接仍有调用额度的 Live 服务以发送消息。
Enter a message between 1 and 1,200 characters.|메시지를 1~1,200자로 입력하세요.|请输入 1 至 1,200 个字符的消息。
Sending to Kiln…|Kiln으로 전송 중…|正在发送至 Kiln…
Sending your message to the live agent through Kiln…|Kiln을 통해 Live 에이전트에게 메시지 전송 중…|正在通过 Kiln 向 Live 智能体发送消息…
Live session expired|Live 세션 만료|Live 会话已到期
This Live session expired after 20 minutes. Start a new negotiation to continue. Previous conversation and proof remain available in the saved task.|Live 세션이 20분 후 만료되었습니다. 계속하려면 새 협상을 시작하세요. 이전 대화와 증빙은 저장된 업무에서 확인할 수 있습니다.|此 Live 会话已在 20 分钟后到期。请开始新协商以继续。此前的对话与凭证仍可在已保存任务中查看。
Start a new negotiation|새 협상 시작|开始新协商
Your task is with Atlas. Waiting for the actual Kiln response…|Atlas에 업무가 전달되었습니다. 실제 Kiln 응답 대기 중…|任务已交给 Atlas，正在等待真实 Kiln 回应…
Sending your instruction to {0} through Kiln…|Kiln을 통해 {0}에 지시 전송 중…|正在通过 Kiln 向 {0} 发送指令…
Give this task a title between 3 and 100 characters.|업무 제목을 3~100자로 입력하세요.|请输入 3 至 100 个字符的任务标题。
Describe the required work in 10 to 4,000 characters.|업무 설명을 10~4,000자로 입력하세요.|请用 10 至 4,000 个字符描述任务。
Use whole test-unit amounts. The per-deal limit cannot exceed the task budget.|정수 테스트 금액을 사용하세요. 거래당 한도는 업무 예산을 초과할 수 없습니다.|请使用整数测试金额，每笔限额不能超过任务预算。
Set a delivery window from 1 to 60 minutes.|납품 시간을 1~60분으로 설정하세요.|请将交付时限设置为 1 至 60 分钟。
The source table has invalid values, duplicate rows or missing HTTP(S) citations. Use 2025–2026 quarters and three-letter currencies.|원본 표에 잘못된 값·중복 행·누락된 HTTP(S) 출처가 있습니다. 2025~2026년 분기와 세 글자 통화 코드를 사용하세요.|源表包含无效值、重复行或缺少 HTTP(S) 引用。请使用 2025–2026 年季度和三字母币种代码。
Live authority could not be checked.|Live 권한을 확인하지 못했습니다.|无法检查 Live 授权。
This workspace needs browser storage and Web Locks. Open it in a recent Chrome, Edge, Firefox or Safari browser.|브라우저 저장소와 Web Locks가 필요합니다. 최신 Chrome, Edge, Firefox 또는 Safari로 열어주세요.|此工作区需要浏览器存储与 Web Locks。请使用较新的 Chrome、Edge、Firefox 或 Safari。
This workspace was created by a newer app version. Refresh this page.|더 최신 앱 버전에서 생성된 작업 공간입니다. 새로고침하세요.|此工作区由更新版本创建，请刷新页面。
Task not found in this browser.|이 브라우저에서 업무를 찾지 못했습니다.|此浏览器中未找到任务。
This task changed in another tab. Refresh it before trying again.|다른 탭에서 업무가 변경되었습니다. 새로고침 후 다시 시도하세요.|任务已在其他标签页更改，请刷新后重试。
This action is not available at this stage.|현재 단계에서는 이 동작을 사용할 수 없습니다.|当前阶段无法执行此操作。
Task authority revoked. New commitments are disabled; existing funded work is preserved.|업무 권한이 철회되었습니다. 새 약정은 중단되며 기존 예치 업무는 유지됩니다.|任务授权已撤销。禁止新增承诺，已注资工作保留。
Task authority revoked.|업무 권한이 철회되었습니다.|任务授权已撤销。
Live mandate changed.|Live 위임 내용이 변경되었습니다.|Live 授权已更改。
Live agreement is not authorized for this task.|이 업무에 승인된 Live 합의가 아닙니다.|此 Live 协议未获授权用于该任务。
Live agreement expired.|Live 합의가 만료되었습니다.|Live 协议已到期。
Start a new deal to change the live mandate.|Live 위임을 바꾸려면 새 거래를 시작하세요.|如需更改 Live 授权，请开始新交易。
Live terms must be negotiated by the connected agents.|Live 조건은 연결된 에이전트가 협상해야 합니다.|Live 条款必须由已连接的智能体协商。
Choose an available offer.|사용 가능한 제안을 선택하세요.|请选择可用报价。
Select an offer first.|먼저 제안을 선택하세요.|请先选择报价。
Enter a whole number of test units for the counteroffer.|역제안 금액을 정수 테스트 단위로 입력하세요.|请以整数测试单位输入还价。
Enter a whole number of test units for the invoice.|청구 금액을 정수 테스트 단위로 입력하세요.|请以整数测试单位输入账单金额。
Use a delivery smaller than 1 MB.|납품 데이터는 1 MB 미만이어야 합니다.|交付数据必须小于 1 MB。
The delivery must be a valid JSON array.|납품 데이터는 유효한 JSON 배열이어야 합니다.|交付必须是有效的 JSON 数组。
Use an array with no more than 1,000 rows.|1,000행 이하의 배열을 사용하세요.|请使用不超过 1,000 行的数组。
LIVE_SERVICE_UNAVAILABLE|Live 서비스를 사용할 수 없습니다. [LIVE_SERVICE_UNAVAILABLE]|Live 服务不可用。[LIVE_SERVICE_UNAVAILABLE]
LIVE_BUYER_AUTHORITY|구매 권한을 초과했습니다. [LIVE_BUYER_AUTHORITY]|超出买方授权。[LIVE_BUYER_AUTHORITY]
LIVE_SELLER_POLICY|판매자 정책을 충족하지 못했습니다. [LIVE_SELLER_POLICY]|不符合卖方规则。[LIVE_SELLER_POLICY]
LIVE_SCOPE_CHANGED|위임 범위가 변경되었습니다. [LIVE_SCOPE_CHANGED]|授权范围发生变化。[LIVE_SCOPE_CHANGED]
LIVE_CALL_LIMIT|모델 호출 한도에 도달했습니다. [LIVE_CALL_LIMIT]|已达到模型调用限额。[LIVE_CALL_LIMIT]
valid json array|유효한 JSON 배열|有效 JSON 数组
minimum rows|최소 행 수|最少行数
required columns|필수 열|必填列
source url coverage|출처 URL 포함 범위|来源网址覆盖
agreed source count|합의된 출처 수|约定来源数量
delivery deadline|납품 기한|交付期限
capex value types|CAPEX 값 형식|CAPEX 数值类型
capex quarter range|CAPEX 분기 범위|CAPEX 季度范围
currency format|통화 형식|币种格式
unique economic rows|경제 데이터 행 고유성|经济数据行唯一性
source values match|원본 값 일치|源值一致
01 / DISCOVERY|01 / 탐색|01 / 发现
01 / MANDATE|01 / 권한 위임|01 / 授权
02 / DEAL|02 / 합의|02 / 协议
03 / DELIVERY|03 / 납품|03 / 交付
03 / EXECUTION|03 / 실행|03 / 执行
03 · RECEIPT|03 · 영수증|03 · 回执
04 / RECEIPT|04 / 영수증|04 / 回执
04 / SETTLEMENT|04 / 정산|04 / 结算
HUMAN|사람|人类
MANDATE|권한 위임|授权
BUYER AGENT|구매 에이전트|采购智能体
SELLER DISCOVERY|판매자 탐색|卖方发现
NEGOTIATION|협상|协商
SIGNED DEAL|서명된 합의|已签协议
ESCROW|에스크로|托管
DELIVERY|납품|交付
SELLER INVOICE|판매자 청구|卖方账单
SETTLEMENT|정산|结算
RECEIPT|영수증|回执
DEAL|거래 합의|协议
BLOCKED|차단됨|已拦截
ALLOWED BY BUDGET|예산 범위에서는 허용|预算允许
BLOCKED BY AGREEMENT|합의에 따라 차단|协议拦截
MATCHED TO AGREEMENT|합의와 일치|与协议一致
OVER BUDGET|예산 초과|超出预算
AUTHORITY STOPPED|권한 중지|授权已停止
AI NEGOTIATES|AI가 협상합니다|AI 协商
CODE AUTHORIZES|코드가 승인합니다|代码授权
EVIDENCE EXPLAINS|증거가 설명합니다|证据解释
Awaiting delegation|위임 대기|等待授权
Awaiting delivery|납품 대기|等待交付
Awaiting offer|제안 대기|等待报价
Awaiting proposals|제안 대기|等待提案
Awaiting signed deal|서명된 합의 대기|等待已签协议
Set by you|사용자가 설정|由您设定
Acts within your mandate|위임 범위 안에서 동작|在授权范围内行动
Can it commit?|약정할 권한이 있나요?|是否有权承诺？
Check commitment|약정 검증|检查承诺
Actual recorded terms|실제로 기록된 조건|实际记录的条款
Both sides commit|양측 약정|双方承诺
Two signatures required|양측 서명 필요|需要双方签名
Does it match?|일치하나요?|是否一致？
Within authority|권한 이내|在授权范围内
Source-table worker|원본 표 처리기|源表处理程序
New story|새 시나리오|新流程
The transaction is explained|거래 결과를 확인했습니다|交易结果已说明
You control the next commitment|다음 약정은 직접 결정하세요|下一项承诺由您决定
Four decisions. One protected transaction.|네 번의 결정으로 보호되는 거래.|四次决策，一笔受保护的交易。
Inspect the verified receipt|검증된 영수증 확인|查看已验证回执
Historical Sepolia proof is separate|Sepolia 과거 증빙은 별도 기록|Sepolia 历史凭证独立保存
No real funds|실제 자금 없음|无真实资金
Deterministic demonstration|정해진 흐름의 시연|确定性演示
Deterministic agents|규칙 기반 에이전트|确定性智能体
Deterministic agents · Real private-EVM execution|규칙 기반 에이전트 · 실제 프라이빗 EVM 실행|确定性智能体 · 真实私有 EVM 执行
Source-table delivery · Actual Kiln negotiation|원본 표 납품 · 실제 Kiln 협상|源表交付 · 真实 Kiln 协商
{0} / 8 model calls · proposals cannot move funds|모델 호출 {0} / 8회 · 제안으로 자금을 이동할 수 없음|模型调用 {0} / 8 次 · 提案无法移动资金
New commitments are disabled.|새 약정이 중단되었습니다.|已禁止新增承诺。
New commitments disabled. Existing funded terms preserved.|새 약정 중단. 기존 예치 조건 유지.|禁止新增承诺，已注资条款保留。
No invalid proposal was accepted. Retry the current turn or choose another seller.|유효하지 않은 제안은 수락되지 않았습니다. 다시 시도하거나 다른 판매자를 선택하세요.|未接受任何无效提案，请重试当前回合或选择其他卖方。
Thinking…|생각 중…|思考中…
Waiting for the actual response.|실제 응답 대기 중.|正在等待真实回应。
`;
const guidedRoomRows = `
Current terms, delivery and available transaction actions.|현재 거래 조건, 납품 상태와 실행 가능한 거래 동작입니다.|当前交易条款、交付状态和可用交易操作。
Recorded history: conversations, gate incidents and original evidence.|대화, 차단 사건과 원본 증거가 저장된 이력입니다.|已保存的对话、拦截事件和原始证据历史。
Current terms|현재 거래 조건|当前交易条款
Signed terms|서명 상태|签名状态
Policy & balances|정책 · 자금 현황|政策与资金
Hide policy & balances|정책 · 자금 현황 접기|收起政策与资金
I need {0} source-linked records. My limit is {1} test USD per deal. Sellers, what can you offer?|출처가 연결된 데이터 {0}건이 필요합니다. 거래당 한도는 테스트 USD {1}입니다. 판매 에이전트 여러분, 조건을 제안해주세요.|我需要 {0} 条附带来源链接的记录。每笔上限为 {1} 测试美元。销售智能体们，请提出报价。
Start demo|데모 시작|开始演示
Your request is ready.|요청이 준비되었습니다.|您的请求已准备就绪。
A buyer. Three sellers. Your rules.|구매 에이전트 1명, 판매 에이전트 3명. 기준은 내가 정합니다.|一个采购智能体，三个销售智能体。规则由您制定。
Review the prepared prompt below, then send it to your buyer.|아래 준비된 요청을 확인하고 구매 에이전트에게 보내세요.|查看下方准备好的提示词，然后发送给采购智能体。
Start the demo, send a prepared request, and follow the agents. You decide what happens when a gate blocks the transaction.|데모를 시작하고 준비된 요청을 보내세요. 에이전트들의 대화를 보다가 거래가 차단되면 직접 다음 행동을 결정합니다.|开始演示并发送准备好的请求，观察智能体对话。交易被拦截时，由您决定下一步。
Buyer agent|구매 에이전트|采购智能体
Seller agents 1 · 2 · 3|판매 에이전트 1 · 2 · 3|销售智能体 1 · 2 · 3
Send to Buyer agent|구매 에이전트에게 보내기|发送给采购智能体
Find four source-linked CAPEX records. My total budget is {0} test USD, with a maximum of {1} test USD per deal. Deliver within {2} minutes. Negotiate with the sellers and ask me before committing funds.|출처가 연결된 CAPEX 데이터 4건을 찾아주세요. 총예산은 테스트 USD {0}, 거래당 한도는 테스트 USD {1}입니다. {2}분 안에 납품해주세요. 판매 에이전트들과 협상하고 자금을 확정하기 전에 제 승인을 받아주세요.|请查找四条附带来源链接的 CAPEX 记录。总预算为 {0} 测试美元，每笔交易上限为 {1} 测试美元。请在 {2} 分钟内交付。与销售智能体协商，并在承诺资金前征求我的批准。
I need {0} source-linked records. My budget is {1} test USD and my limit is {2} per deal. Sellers, what can you offer?|출처가 연결된 데이터 {0}건이 필요합니다. 총예산은 테스트 USD {1}, 거래당 한도는 {2}입니다. 판매 에이전트 여러분, 조건을 제안해주세요.|我需要 {0} 条附带来源链接的记录。预算为 {1} 测试美元，每笔上限为 {2}。销售智能体们，请提出报价。
I prioritize source coverage and consistent data. My offer is {0} test USD for the complete task.|저는 출처를 빠짐없이 포함하고 데이터를 일관되게 정리하는 데 집중합니다. 전체 작업을 테스트 USD {0}에 제안합니다.|我注重完整的来源覆盖和一致的数据。整个任务报价为 {0} 测试美元。
I prioritize fast delivery. My offer is {0} test USD for the complete task.|저는 빠른 납품에 집중합니다. 전체 작업을 테스트 USD {0}에 제안합니다.|我注重快速交付。整个任务报价为 {0} 测试美元。
I prioritize research quality and source detail. My offer is {0} test USD for the complete task.|저는 조사 품질과 상세한 출처 정보에 집중합니다. 전체 작업을 테스트 USD {0}에 제안합니다.|我注重研究质量和详细的来源信息。整个任务报价为 {0} 测试美元。
Can you do the same scope for {0} test USD? Keep all required sources.|작업 범위는 그대로 유지하고 테스트 USD {0}에 가능할까요? 필요한 출처도 모두 포함해주세요.|同样的工作范围可以按 {0} 测试美元成交吗？请保留所有必需来源。
Guided narration · recorded event|데모 대화 · 실제 저장된 이벤트 기반|演示旁白 · 基于已记录事件
Gate incident saved|차단 기록 저장됨|拦截记录已保存
View original record|원본 기록 보기|查看原始记录
Recorded at|기록 시각|记录时间
Event ID|이벤트 ID|事件 ID
Every card comes from a recorded event. Expand it to see the original evidence.|각 카드는 실제 저장된 이벤트입니다. 펼치면 원본 증거를 볼 수 있습니다.|每张卡片均来自已记录的事件。展开即可查看原始证据。
Conversation and incident records are stored in this browser. They are not independently signed receipts. Technical proof separately verifies the agreement and settlement.|대화와 사건 기록은 이 브라우저에 저장됩니다. 자체적으로 서명된 영수증은 아닙니다. 기술 증거에서 합의와 정산을 별도로 검증합니다.|对话与事件记录保存在此浏览器中，不属于独立签名的收据。技术证据会单独验证协议和结算。
Original model messages and request evidence are preserved as received.|모델 응답과 요청 증거는 수신한 원문 그대로 보존합니다.|模型消息和请求证据按收到的原文保留。
Current execution: private EVM. Historical Sepolia evidence is separate.|현재 실행: 비공개 EVM. 과거 Sepolia 증거는 별도입니다.|当前执行：私有 EVM。历史 Sepolia 证据单独展示。
Next: ask the buyer to negotiate within your limit.|다음: 구매 에이전트에게 한도 내에서 협상하도록 요청하세요.|下一步：让采购智能体在限额内协商。
Next: correct the invoice to the signed amount before payment.|다음: 결제 전에 청구액을 서명한 합의 금액으로 수정하세요.|下一步：付款前将账单更正为已签署的金额。
Why blocked & what was saved|차단 이유와 저장된 기록|拦截原因与保存的记录
`;
export const messages = [rows,detailRows,runtimeRows,validationRows,guidedRoomRows].flatMap(block=>block.trim().split('\n').map(line => line.split('|')));
