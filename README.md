# CrossBorderX

A US→UK (and planned US→India) remittance platform using **stablecoins as invisible settlement infrastructure**. The sender pays in fiat, the recipient receives fiat, and USDC on Solana moves the value across the border in the middle.

> **Status:** Technically complete prototype. Kept as a portfolio piece - not pursued as a startup. See the post-mortem below for why.

---

## What It Does

The blockchain is invisible plumbing - neither sender nor recipient touches crypto.

```
Sender (USD) → Stripe (collect) → Circle (USD→USDC) → Solana (US→UK wallet)
→ B2C2 (USDC→GBP) → ClearBank (Faster Payments) → Recipient (GBP)
```

To make transfers feel instant despite slow funding, the design used a **prefunded USDC liquidity pool**: pay the recipient immediately from our own float, then let the sender's slow payment refill the pool in the background.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | NestJS + TypeScript (deployed on Render) |
| Frontend | Next.js + TypeScript + Tailwind (deployed on Vercel) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Blockchain | Solana (devnet) + USDC SPL token |
| Payments (designed) | Stripe, Circle Mint, B2C2, ClearBank |

**What works end-to-end:** real on-chain USDC settlement on Solana devnet, a double-entry append-only ledger with reconciliation, a 7-step transaction orchestrator with a state machine, an admin dashboard, and a fully deployed cloud stack.

**The technology was never the problem. The business model was.**

---

# Post-Mortem: Why the Business Model Didn't Work

## Why It Failed - Four Compounding Reasons

### 1. The liquidity pool requires capital we don't have
To front payments instantly while waiting 2–3 days for ACH to clear, we'd need roughly **4–5x daily volume** sitting idle as float (~$45K for $10K/day, ~$1M+ for real volume). Remittance is structurally capital-intensive; the float is dead money you must own before earning anything. As a solo builder with no budget, this alone is a hard blocker.

### 2. The funding rail destroys the margin
Stripe **card** payments cost ~2.9% (~$30 on $1000) - more than the entire transfer should cost. Stripe **ACH** is cheaper (~0.8%, capped ~$5) but takes 2–3 days to settle, which only works *with* the float pool from problem #1. Either way, the on-ramp (fiat→USDC) eats most of the margin before we add a cent of our own fee.

### 3. The India corridor is killed by the 1% TDS + regulatory grey zone
India charges a **1% TDS on every crypto conversion** (~$10 on $1000) plus a 30% tax on gains, and the RBI's stance on crypto-as-remittance-rail is unsettled and tightening. This tax hits the crypto rail but **not** fiat competitors like Wise - making us structurally ~4–5x more expensive on India despite cheap UPI payout rails.

### 4. We can't beat incumbents on the corridors we chose
- **US→UK:** Wise does it all-in for ~0.5–0.7%, door-to-door, no crypto step. Our all-in was ~1.5–4%. We lose.
- **US→India / UK→India:** Wise and specialists do ~0.4–0.7%. Our crypto-tax-laden cost was ~2.5–3%. We lose.

The pattern: **any large, popular corridor is already cheap and competitive.** Stablecoins only win on hard, expensive, neglected corridors (parts of Africa/LatAm) where incumbents charge 6–8%.

---

## The Deeper Lesson

Even on the corridors where stablecoins *do* win, the infrastructure is already commoditized. Well-funded players - **Bitso** ($6.5B US→Mexico volume), **Felix Pago** ($1B+ via WhatsApp), **LemFi** (backed by Tether), **SukuPay** (US→Guatemala at $0.99 flat) - already do cheap, fast USDC settlement. As one industry analysis put it: *the moat is no longer infrastructure, it's distribution.*

**The technology of moving USDC across borders is solved and cheap.** The value is in owning a specific community's trust, channel, and spending behavior - not in building better pipes. A solo builder cannot win the infrastructure war against VC-funded incumbents, and we had no distribution wedge into a specific underserved community.

---

## Verdict

A technically successful prototype and a genuinely valuable learning project - but not a viable business as designed, because:

- The float model needs capital we don't have.
- The cheap funding rail (ACH) needs that same float to feel instant.
- Our target corridors (UK/India) are already cheaper via incumbents.
- The corridors where we'd win require distribution and partnerships we don't have, against competitors who already own them.

**Kept as a portfolio piece** demonstrating fintech architecture, blockchain settlement, double-entry ledgers, and full-stack cloud deployment - not pursued as a startup.

<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->


# Phase 1 is COMPLETE!
Here's what you've built so far:

- Redis cache running
- 13 ledger accounts seeded (the financial backbone)
- User registration with password hashing
- Login with JWT token generation
- Protected routes (the /me endpoint needs a valid token)

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).


## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
