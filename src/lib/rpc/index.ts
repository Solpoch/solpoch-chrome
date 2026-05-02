import { Connection, PublicKey, Transaction, VersionedTransaction, type Blockhash, type Commitment, type RpcResponseAndContext, type SignatureStatus, type SimulatedTransactionResponse, type SimulateTransactionConfig, type TransactionSignature } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, createTransferInstruction, getAccount, getAssociatedTokenAddressSync, getMint, TOKEN_PROGRAM_ID, type Account } from "@solana/spl-token";
import {
  MPL_TOKEN_METADATA_PROGRAM_ID,
  deserializeMetadata,
} from "@metaplex-foundation/mpl-token-metadata";
import { publicKey as PublicKeyMeta } from "@metaplex-foundation/umi";
import { RpcTracer, type TraceContext } from "./tracer";

const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  MPL_TOKEN_METADATA_PROGRAM_ID
);

const rpcEndpoints = {
  devnet: "https://api.devnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
};

const rpcConnection = new Connection(rpcEndpoints.devnet, "confirmed");

export class RpcService {

  static getConnection(): Connection {
    return rpcConnection;
  }

  static async traceCall<T>(
    method: string,
    attributes: Record<string, any>,
    rpcfn: (ctx: TraceContext) => Promise<T>,
    ctx?: TraceContext
  ): Promise<T> {
    const span = RpcTracer.start(method, attributes, ctx);

    const childCtx: TraceContext = {
      traceId: span.traceId,
      parentId: span.id,
    };

    try {
      const result = await rpcfn(childCtx);
      RpcTracer.success(span.id, result);
      return result;
    } catch (err) {
      RpcTracer.error(span.id, err);
      throw err;
    }
  }

  static async getBalance(publicKey: string, parentCtx?: TraceContext): Promise<number> {
    return this.traceCall(
      "RPC : getBalance",
      { publicKey },
      async () => {
        const connection = this.getConnection();
        const balance = await connection.getBalance(new PublicKey(publicKey));
        return balance;
      },
      parentCtx
    );
  }

  static async getLatestBlockhash(parentCtx?: TraceContext): Promise<Readonly<{
    blockhash: Blockhash;
    lastValidBlockHeight: number;
  }>> {
    return this.traceCall(
      "RPC : getLatestBlockhash",
      {},
      async () => {
        const connection = this.getConnection();
        const latestBlockHash = await connection.getLatestBlockhash();
        return latestBlockHash;
      },
      parentCtx
    );
  }

  static async sendRawTransaction(signedTx: Transaction, parentCtx?: TraceContext): Promise<TransactionSignature> {
    return this.traceCall(
      "RPC : sendRawTransaction",
      { signedTx: "redacted" },
      async () => {
        const connection = this.getConnection();
        const signature = await connection.sendRawTransaction(
          signedTx.serialize(),
          { maxRetries: 3 }
        );
        return signature;
      },
      parentCtx
    );
  }

  static async simulateTransaction(signedTx: Transaction, config: SimulateTransactionConfig, parentCtx?: TraceContext): Promise<RpcResponseAndContext<SimulatedTransactionResponse>> {
    return this.traceCall(
      "RPC : simulateTransaction",
      {
        signedTx: "redacted",
        config: {
          sigVerify: config.sigVerify,
          replaceRecentBlockhash: config.replaceRecentBlockhash,
        }
      },
      async () => {
        const connection = this.getConnection();
        const versionedTx = new VersionedTransaction(signedTx.compileMessage());
        const simulation = await connection.simulateTransaction(versionedTx, config);
        return simulation;
      },
      parentCtx
    );
  }

  static async getBlockHeight(parentCtx?: TraceContext): Promise<number> {
    return this.traceCall(
      "RPC : getBlockHeight",
      {},
      async () => {
        const connection = this.getConnection();
        const blockHeight = await connection.getBlockHeight();
        return blockHeight;
      },
      parentCtx
    );
  }

  static async getSignatureStatuses(signatures: string[], parentCtx?: TraceContext): Promise<RpcResponseAndContext<(SignatureStatus | null)[]>> {
    return this.traceCall(
      "RPC : getSignatureStatuses",
      { signatures },
      async () => {
        const connection = this.getConnection();
        const statuses = await connection.getSignatureStatuses(signatures);
        return statuses;
      },
      parentCtx
    );
  }

  static async getAssociatedTokenAccountInfo(publicKey: string, mintAddress: string) {
    const connection = this.getConnection();
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(publicKey),
      { mint: new PublicKey(mintAddress) }
    );

    if (tokenAccounts.value.length === 0) {
      return null;
    }

    const info = tokenAccounts.value[0].account.data.parsed.info;

    return {
      mint: info.mint,
      balance: info.tokenAmount.uiAmount,
      decimals: info.tokenAmount.decimals,
      tokenAccount: tokenAccounts.value[0].pubkey.toBase58(),
    };
  }

  static async getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve = false,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
    parentCtx?: TraceContext
  ): Promise<PublicKey> {
    return this.traceCall(
      "SPL : getAssociatedTokenAddress",
      {
        mint: mint.toBase58(),
        owner: owner.toBase58(),
        allowOwnerOffCurve,
      },
      async () =>
        getAssociatedTokenAddressSync(
          mint,
          owner,
          allowOwnerOffCurve,
          programId,
          associatedTokenProgramId
        ),
      parentCtx
    );
  }

  static async getAccount(
    address: PublicKey,
    commitment?: Commitment,
    programId = TOKEN_PROGRAM_ID,
    parentCtx?: TraceContext
  ): Promise<Account> {
    return this.traceCall(
      "SPL : getAccount",
      { address: address.toBase58() },
      async () => {
        const connection = this.getConnection();
        return getAccount(connection, address, commitment, programId);
      },
      parentCtx
    );
  }

  static async createAssociatedTokenAccountInstruction(
    payer: PublicKey,
    associatedToken: PublicKey,
    owner: PublicKey,
    mint: PublicKey,
    programId = TOKEN_PROGRAM_ID,
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID,
    parentCtx?: TraceContext
  ) {
    return this.traceCall(
      "SPL : createAssociatedTokenAccountInstruction",
      {
        payer: payer.toBase58(),
        associatedToken: associatedToken.toBase58(),
        owner: owner.toBase58(),
        mint: mint.toBase58(),
      },
      async () =>
        createAssociatedTokenAccountInstruction(
          payer,
          associatedToken,
          owner,
          mint,
          programId,
          associatedTokenProgramId
        ),
      parentCtx
    );
  }

  static async createTransferInstruction(
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: number | bigint,
    multiSigners: PublicKey[] = [],
    programId = TOKEN_PROGRAM_ID,
    parentCtx?: TraceContext
  ) {
    return this.traceCall(
      "SPL : createTransferInstruction",
      {
        source: source.toBase58(),
        destination: destination.toBase58(),
        owner: owner.toBase58(),
        amount: amount.toString(),
      },
      async () =>
        createTransferInstruction(
          source,
          destination,
          owner,
          amount,
          multiSigners,
          programId
        ),
      parentCtx
    );
  }

  static async getMintTokenInfo(mintAddress: string) {
    const connection = this.getConnection();
    const mintPubkey = new PublicKey(mintAddress);

    try {
      // fetch mint info
      const mintInfo = await getMint(connection, mintPubkey);

      const decimals = mintInfo.decimals;
      const supply = mintInfo.supply;
      const mintAuthority = mintInfo.mintAuthority?.toBase58() || null;
      const freezeAuthority = mintInfo.freezeAuthority?.toBase58() || null;

      // derive metadata PDA
      const [metadataPDA] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mintPubkey.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      );

      const accountInfo = await connection.getAccountInfo(metadataPDA);

      let name = null;
      let symbol = null;
      let uri = null;
      let json: any = null;

      if (accountInfo) {
        const rpcAccount = {
          executable: accountInfo.executable,
          owner: PublicKeyMeta(accountInfo.owner.toBase58()),
          lamports: {
            basisPoints: BigInt(accountInfo.lamports),
            identifier: "SOL" as const,
            decimals: 9 as const,
          },
          data: new Uint8Array(accountInfo.data),
          publicKey: PublicKeyMeta(metadataPDA.toBase58()),
        };

        const metadata = deserializeMetadata(rpcAccount);

        name = metadata.name.replace(/\0/g, "");
        symbol = metadata.symbol.replace(/\0/g, "");
        uri = metadata.uri.replace(/\0/g, "");

        try {
          const res = await fetch(uri);
          json = await res.json();
        } catch { }
      }

      return {
        mintAddress,
        name,
        symbol,
        uri,

        image: json?.image || null,
        description: json?.description || null,

        decimals,
        supply: supply.toString(),

        mintAuthority,
        freezeAuthority,

        metadata: json
      };

    } catch (err) {
      console.error("Token fetch failed:", err);
      return null;
    }
  }

  static async getTokenList(publicKey: string) {
    const connection = this.getConnection();

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      new PublicKey(publicKey),
      { programId: TOKEN_PROGRAM_ID }
    );

    const parsedTokens = tokenAccounts.value.map((t) => {
      const info = t.account.data.parsed.info;

      return {
        mint: info.mint,
        balance: info.tokenAmount.uiAmount,
        decimals: info.tokenAmount.decimals,
        tokenAccount: t.pubkey.toBase58(),
      };
    });

    const mints = parsedTokens.map((t) => new PublicKey(t.mint));

    // derive metadata PDAs
    const metadataPDAs = mints.map((mint) =>
      PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )[0]
    );

    // batch fetch metadata accounts
    const metadataAccounts = await connection.getMultipleAccountsInfo(metadataPDAs);

    const metadataResults = await Promise.all(
      metadataAccounts.map(async (account, i) => {
        if (!account) return null;

        try {
          // Construct a proper RpcAccount object instead of passing raw buffer
          const rpcAccount = {
            executable: account.executable,
            owner: PublicKeyMeta(account.owner.toBase58()),
            lamports: {
              basisPoints: BigInt(account.lamports),
              identifier: "SOL" as const,
              decimals: 9 as const,
            },
            data: new Uint8Array(account.data),
            publicKey: PublicKeyMeta(metadataPDAs[i].toBase58()),
          };

          const metadata = deserializeMetadata(rpcAccount);

          const uri = metadata.uri.replace(/\0/g, "");

          let json = null;

          try {
            const res = await fetch(uri);
            json = await res.json();
          } catch { }

          return {
            name: metadata.name.replace(/\0/g, ""),
            symbol: metadata.symbol.replace(/\0/g, ""),
            uri,
            json,
          };
        } catch {
          return null;
        }
      })
    );

    // merge token + metadata
    const result = parsedTokens.map((token, i) => ({
      ...token,
      metadata: metadataResults[i],
    }));

    return result;
  }

  static async getTransactionsForAddress(address: string) {
    const connection = this.getConnection();
    const confirmedSignatures = await connection.getSignaturesForAddress(new PublicKey(address));
    const signatures = confirmedSignatures.map((sig) => sig.signature).slice(0, 5); // limit to 5 transactions for now
    const transactions = [];

    for (let i = 0; i < signatures.length; i++) {
      const tx = await connection.getTransaction(signatures[i]);
      transactions.push(tx);

      // Throttle follow-up RPC requests when fetching multiple signatures.
      if (signatures.length > 1 && i < signatures.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log({ transactions });
    return transactions;
  };

  // methods for transaction service for spl

}