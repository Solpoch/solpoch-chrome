<div align="center"> 
    
<img width="250" height="100" alt="logo" src="https://github.com/user-attachments/assets/6b70d1c4-2260-48b7-829f-4f69751cca57" />

</div>

<p align="center">
Chrome DevTools for Solana Transactions.
</p>

<p align="center">
<a href="https://solpoch.site/">Website</a> • 
<a href="https://github.com/Solpoch/solpoch-chrome/releases/">Download Alpha</a>
</p>

---

Solana transaction debugging is painful.

When a transaction fails, developers usually end up:
- reading raw logs
- replaying transactions manually
- decoding instructions by hand
- guessing which CPI failed
- retrying blindly

Most wallets only show:
```txt
Transaction failed.
Custom program error: 0x1
```

Solpoch is built to make Solana transactions observable.

It lets developers inspect, simulate, trace, and understand wallet interactions before and after execution.

Instead of guessing what happened, Solpoch shows:
- decoded transaction payloads
- execution traces
- preflight simulation results
- account and token changes
- wallet-standard requests
- AI-powered failure diagnosis
- RPC-level debugging utilities

Built for:
- Solana developers
- smart contract engineers
- wallet integrators
- protocol teams
- hackathon builders
- power users debugging dApps

Core Features

- Transaction simulation before signing
- Execution trace visualization
- Decoded dApp payload inspection
- Wallet Standard support
  - signTransaction
  - signAndSendTransaction
  - signMessage
  - signIn
  - and more
- AI-assisted transaction diagnosis
- Multi-account support
- SPL token tooling
- RPC debugging utilities
- Dev-focused transaction insights

Example Workflow

1. A dApp requests a transaction
2. Solpoch decodes and visualizes the payload
3. The transaction is simulated before execution
4. Failed instructions and logs are surfaced clearly
5. Suggested fixes and debugging insights are provided
6. The developer understands exactly what went wrong

Why Solpoch

Existing wallets optimize for sending transactions.

Solpoch optimizes for understanding them.

---

Status

Alpha release — actively under development.

Feedback, issues, and contributions are welcome.
