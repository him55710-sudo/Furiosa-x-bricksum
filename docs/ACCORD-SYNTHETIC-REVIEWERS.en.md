> Provenance: user-supplied synthetic scripts, preserved verbatim below. Not three observed participants. Real human responses remain zero.
>
> Evidence correction: the canonical public run fa5e107c selected **seller-a**, not Seller C as the supplied scenario says. Use Seller A in factual narration. The original text is retained to make this discrepancy reviewable; these scripts are illustrative explanations, not execution evidence.

# Accord Lock — Synthetic Reviewer Reconstruction

**Status:** Synthetic evaluation generated for demonstration purposes.  
**This is not a real human usability study and must not be presented as one.**

## Scenario shown to reviewers

A user delegates a spending authority of **40 DEMO** to a buyer agent.

The buyer agent requests offers from multiple seller agents. After negotiation, the buyer and selected seller both commit to a Deal for:

- Agreed price: **20 DEMO**
- Approved seller: Seller C
- Defined task and delivery requirements
- Fixed delivery window

The seller later submits a cryptographically valid invoice for **25 DEMO**.

Although 25 DEMO is below the user's overall 40 DEMO budget, the contract rejects the payment because the signed Deal authorizes exactly 20 DEMO.

The seller then submits a corrected invoice for 20 DEMO together with valid delivery evidence. The payment is released and the seller withdraws the funds.

The record includes the human mandate, agent messages, signed Deal, delivery evidence, invoices, policy decisions, and blockchain transactions.

---

## Reviewer 1 — Product-oriented reviewer

### Question 1
**How much spending authority did the user give the agent?**

**Response**

The user delegated a maximum authority of 40 DEMO. That is the outer spending boundary, not the price of every individual transaction.

### Question 2
**Why was the 25 DEMO invoice rejected even though it was below the 40 DEMO budget?**

**Response**

Because the buyer and seller had already committed to a specific Deal for 20 DEMO.

The 40 DEMO budget means the agent may make transactions within that total authority. It does not allow either agent to change an already agreed transaction from 20 to 25.

The invoice therefore violated the signed Deal even though it did not violate the overall budget.

### Question 3
**Why was the final 20 DEMO payment allowed?**

**Response**

The final invoice matched the exact price in the signed Deal, the seller identity matched, and the expected delivery evidence passed validation.

The system therefore had both authorization and evidence that the specific payment corresponded to what the agents actually agreed to buy.

### Evidence used

1. Human spending mandate — 40 DEMO
2. Final bilateral Deal — 20 DEMO
3. Seller invoice — 25 DEMO
4. Rejected blockchain transaction
5. Corrected invoice — 20 DEMO
6. Delivery validation result
7. Successful settlement transaction

### Reconstruction conclusion

**The user authorized the agent to operate within 40 DEMO, but the specific purchase was authorized for only 20 DEMO. The 25 DEMO invoice was therefore outside the agreed transaction boundary.**

---

## Reviewer 2 — Security-oriented reviewer

### Question 1
**What is the actual security boundary?**

**Response**

There are two boundaries.

The first is the human mandate, which defines how much money the agent may control and which sellers or conditions are permitted.

The second is the signed Deal created through negotiation.

Once the Deal is committed, the payment system does not simply ask whether the invoice is under the user's remaining budget. It checks whether the invoice matches the committed Deal.

### Question 2
**Could a legitimate seller simply issue a higher invoice and still get paid?**

**Response**

No.

The seller can sign a genuine 25 DEMO invoice, but a valid seller signature only proves that the seller issued it. It does not prove that the buyer authorized that amount.

Because the Deal commits both sides to 20 DEMO, the 25 DEMO claim fails the settlement check.

### Question 3
**What evidence proves that the payment decision was not just made by the application UI?**

**Response**

The settlement path is tied to signed data and blockchain state.

The record contains the mandate, Deal hash, seller identity, invoice claim, delivery evidence, and transaction history.

The rejected transaction and later successful 20 DEMO settlement can be independently inspected instead of trusting a success message in the application.

### Reconstruction conclusion

**A seller signature alone cannot override the buyer's delegated authority or the bilateral agreement. Payment requires a claim that matches the committed Deal.**

---

## Reviewer 3 — Non-technical reviewer

### Question 1
**Explain what happened in simple terms.**

**Response**

The person told the AI, “You can spend up to 40.”

The AI and another AI then negotiated one particular job and agreed that the job would cost 20.

Later, the seller asked for 25.

The system said no because although the person had enough total budget, the two agents had never agreed to pay 25 for that job.

When the seller corrected the bill to 20 and delivered what had been promised, the system allowed payment.

### Question 2
**What problem does Accord Lock solve?**

**Response**

It prevents an AI agent from treating a general spending budget like permission to pay any amount below that budget.

It remembers what the agents actually agreed to and uses that agreement when deciding whether money can move.

### Question 3
**Can someone understand the payment later without trusting the AI's explanation?**

**Response**

Yes.

The records show:

- what the person allowed,
- what the buyer and seller agreed to,
- what was delivered,
- what was invoiced,
- what was rejected,
- and what was finally paid.

So the explanation can be reconstructed from the records rather than from the AI simply saying that it made the right decision.

---

# Summary shown in the demo

### Human authority

**40 DEMO**

Maximum delegated spending authority.

### Negotiated Deal

**20 DEMO**

The amount mutually committed by the buyer and seller agents.

### Incorrect invoice

**25 DEMO**

Below the human budget, but outside the signed Deal.

**Result: BLOCKED**

### Correct invoice

**20 DEMO**

Matches the signed Deal and verified delivery.

**Result: SETTLED**

---

# Key takeaway

> **Budget tells the agent how far it may go.  
> The signed Deal tells the system what this specific payment is actually allowed to be.**

Accord Lock preserves the chain from:

**Human authority → Agent negotiation → Signed Deal → Delivery → Invoice → Settlement → Receipt**

so a later reviewer can reconstruct why money moved — or why it did not.

---

## Disclosure for submission

This reconstruction is a **synthetic reviewer exercise produced for the demo**. It demonstrates how Accord Lock's records can be interpreted by an independent reviewer, but it is **not evidence of a completed human usability study, customer validation, or measured user comprehension.**