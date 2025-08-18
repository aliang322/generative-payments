# 🌐 Dynamic Crypto Onboarding Flow

### Dynamic simplifies crypto transfers and onboarding for any user, regardless of their wallet experience!  

#### Mission: Onboard the next billion users to crypto by combining NLP-driven plans, automated wallets, and cross-chain transfers  

---

## 💡 Inspiration  

**Crypto onboarding is complicated.** Many users either have no wallet, no crypto, or are unfamiliar with chain selection and token transfers. Existing solutions often require technical expertise or multiple platforms.  

**Dynamic** solves this by providing a guided, role-based flow for sending and receiving crypto with minimal friction, all powered by structured NLP and automated wallets.  

---

## ❓ What it does  

**Dynamic** enables users to create and accept crypto transfer plans through a simple, interactive flow:  

1. **Sign in**
   - “I have no crypto” → provision a Dynamic embedded wallet (EVM default)  
   - “I have a wallet” (MetaMask, etc.) → connect via Dynamic  

2. **Plan creation**
   - User describes transfer plan in plain language  
   - NLP converts the description into structured JSON variables  
   - JSON variables drive **CCTP v2 Fast transfers** from an Agent Wallet using automated cron jobs  

3. **Role selection**
   - Sender chooses to fund the plan  
   - Receiver chooses the receiving chain (must be supported by CCTP Fast/Standard)  

4. **Funding options**
   - Option 1: **Fern Onramp** → fiat → USDC → Agent Wallet  
   - Option 2: Transfer existing USDC from connected or embedded wallet  

5. **Plan acceptance & execution**
   - Share acceptance link with the counterparty (contains plan terms, policy hash, supported chains)  
   - Receiver authenticates via Dynamic (instant wallet if needed)  
   - Optional Auto Cash-Out (Fern) after KYC/payout profile  

6. **Chain compatibility**
   - If the selected source or destination chain is unsupported, Dynamic prompts a switch to a supported chain  

---

## 🚧 How we built it  

**Technologies Used:**  
- Dynamic Embedded Wallets  
- MetaMask Integration  
- NLP for structured plan extraction  
- CCTP v2 Fast Transfers  
- Vercel Cron Jobs  
- Fern Onramp  

**Key Components:**  
1. **Dynamic Wallet Provisioning** – Automatically create wallets for users who don’t have crypto  
2. **NLP-Driven Plan Parsing** – Convert unstructured user input into actionable JSON variables  
3. **Agent Wallet Automation** – Agent Wallets receive sender USDC and trigger CCTP v2 transfers  
4. **Role-Based Flow** – Clear separation between sender and receiver for plan creation and acceptance  
5. **Cross-Chain Transfers** – Leverages CCTP v2 to support multiple chains and ensure fast settlement  
6. **Optional Auto Cash-Out** – Automatically convert USDC to fiat via Fern after KYC verification  

