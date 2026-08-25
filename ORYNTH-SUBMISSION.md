# 9ncore — Orynth submission

Paste-ready answers for the 13-page Orynth project form.

## 1. What are you launching?

**Product**

## 2. Product name

**9ncore**

## 3. One-line pitch

**Confidential lending experiments powered by FHE.**

## 4. Where can people try it?

https://9ncore.vercel.app

## 5. What makes it special?

9ncore explores confidential lending on Ethereum with Zama FHEVM. Users can lend test USDC, deposit ETH collateral, borrow, repay, and inspect positions on Sepolia. The contract maintains encrypted collateral and debt mirrors, applies FHE arithmetic to interest and health calculations, and supports borrower-authorized gateway decryption. It is an experimental testnet prototype: LTV/liquidation accounting and amount events are still public, so it is not end-to-end private.

## 6. Logo

Upload:

`frontend/brand/9ncore-logo.png`

Source artwork:

`frontend/public/logo.svg`

## 7. Screenshots

Upload in this order; the first image becomes the cover:

1. `frontend/docs/images/landing.png`
2. `frontend/docs/images/borrow.png`
3. `frontend/docs/images/lend.png`
4. `frontend/docs/images/dashboard.png`

## 8. Categories

Select these three, using the closest available wording in the form:

1. **Blockchain & Crypto**
2. **Finance**
3. **Privacy & Security**

## 9. Extra links

- GitHub: https://github.com/dmustapha/9ncore
- Demo video: https://www.loom.com/share/564bdc5d74da4b5092cd837978689206
- Twitter/X: leave blank unless a project account exists
- Telegram: leave blank unless a project community exists

If Orynth accepts only YouTube in the demo field, upload the Loom recording to YouTube first and paste that URL instead.

## 10. Team

**Solo project — add the submitting Orynth profile as the maker.**

Do not add a name inside the written launch copy.

## 11. First launch comment

I built 9ncore because borrowing on a public ledger can turn a financial position into a public profile. I wanted to explore how fully homomorphic encryption could support lending logic while keeping sensitive position state encrypted for computation.

The current Sepolia prototype covers the full borrower and lender flow: supplying test USDC, depositing ETH collateral, borrowing, repaying, withdrawing, and checking position state. It maintains encrypted collateral and debt mirrors, performs interest and health arithmetic with Zama FHEVM, and lets the borrower request gateway decryption with an EIP-712 signature. The deployed contract has a full-match Sourcify verification, and the repository includes eight FHEVM mock tests covering the core flows.

This is an experimental testnet prototype, not an audited lending protocol. The current contract still uses public accounting values for LTV checks and liquidation and emits transaction amounts, so it does not yet provide end-to-end confidentiality and should not be used with real funds.

I am listing it to get feedback from FHE and DeFi builders on removing the remaining plaintext accounting, designing private liquidation, and making the privacy boundary clear to users.

Hosted demo: https://9ncore.vercel.app

Source and deployment proof: https://github.com/dmustapha/9ncore

## 12. Founder introduction video

**Optional — leave blank unless you have a separate founder-introduction video.**

The product demo belongs in the demo-video field on page 9.

## 13. Final review

Before submitting, confirm:

- Product name is **9ncore**.
- Website is `https://9ncore.vercel.app`.
- GitHub is `https://github.com/dmustapha/9ncore`.
- The first screenshot is `landing.png`.
- No unsupported social links were added.
- The listing says **Sepolia**, **experimental**, **not audited**, and **not for real funds**.
- Ownership verification uses the live meta tag on the website.

## Ownership verification

The production website publishes:

```html
<meta name="ory-verify" content="orynth-5437a6a443bd4fae9f602770895f62a2" />
```

On Orynth, click **Verify ownership** or **Try again**.

## Accuracy note

The current Solidity implementation stores encrypted mirrors but also exposes `collateralETH`, `plainDebt`, and amount-bearing events. Avoid claims such as “balances never appear in plaintext” or “liquidators cannot infer position size” until that public accounting path is removed.
