import { PublicKey, SystemProgram, Transaction, type Commitment, type SimulateTransactionConfig } from "@solana/web3.js"
import { vaultService } from "../vault/service"
import type { MessageResponse } from "../../../types/message"
import { RpcService } from "../../rpc"
import bs58 from "bs58";
import { chains, features } from "../../utils/solana/walletFeatures";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, TokenAccountNotFoundError, TokenInvalidAccountOwnerError, TokenInvalidMintError, TokenInvalidOwnerError, type Account } from "@solana/spl-token";
import { RpcTracer } from "../../rpc/tracer";

export abstract class TransactionService {

  private static async buildTransaction(to: string, amount: number): Promise<{ tx: Transaction; publicKey: string }> {
    const account = await vaultService.getActiveAccount()
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: new PublicKey(account.pubkey),
        toPubkey: new PublicKey(to),
        lamports: amount
      })
    )

    return { tx, publicKey: account.pubkey }
  }

  static async signTransaction(tx: Transaction, password: string): Promise<Transaction> {
    const signedTx = await vaultService.signTransaction(tx, password)
    return signedTx
  }

  static async simulateTransaction(
    to: string,
    amount: number,
    password: string
  ): Promise<MessageResponse<"SIMULATE_TRANSACTION">> {
    const rootSpan = RpcTracer.start("SIMULATION_FLOW", { to, amount });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };

    RpcTracer.addEvent(rootSpan.id, "VAULT : Building transaction");
    const { tx, publicKey } = await this.buildTransaction(to, amount);

    RpcTracer.addEvent(rootSpan.id, "Fetching blockhash");
    const { blockhash } = await RpcService.getLatestBlockhash(ctx);
    tx.recentBlockhash = blockhash
    tx.feePayer = new PublicKey(publicKey)

    RpcTracer.addEvent(rootSpan.id, "VAULT : Signing transaction");
    const signedTx = await this.signTransaction(tx, password)
    const config: SimulateTransactionConfig = { commitment: "confirmed" }
    RpcTracer.addEvent(rootSpan.id, "Simulating transaction");
    const simulation = await RpcService.simulateTransaction(signedTx, config, ctx);

    if (simulation.value.err) {
      RpcTracer.error(rootSpan.id, simulation);
    } else {
      RpcTracer.success(rootSpan.id, simulation);
    }

    console.log("Simulation result:", simulation);
    return {
      success: true,
      data: simulation.value,
    }
  }

  static async sendTransaction(
    to: string,
    amount: number,
    password: string
  ): Promise<MessageResponse<"SIGN_AND_SEND_TRANSACTION">> {
    const rootSpan = RpcTracer.start("SEND_TRANSACTION_FLOW", { to, amount });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };

    RpcTracer.addEvent(rootSpan.id, "VAULT : Building transaction");
    const { tx, publicKey } = await this.buildTransaction(to, amount)

    RpcTracer.addEvent(rootSpan.id, "Fetching blockhash");
    const { blockhash, lastValidBlockHeight } = await RpcService.getLatestBlockhash(ctx);
    tx.recentBlockhash = blockhash
    tx.feePayer = new PublicKey(publicKey)

    RpcTracer.addEvent(rootSpan.id, "VAULT : Signing transaction");
    const signedTx = await this.signTransaction(tx, password)
    RpcTracer.addEvent(rootSpan.id, "Sending transaction");
    const signature = await RpcService.sendRawTransaction(signedTx, ctx)

    RpcTracer.addEvent(rootSpan.id, "Polling for confirmation");
    const confirmed = await this.pollForConfirmation(
      signature,
      lastValidBlockHeight
    )

    if (!confirmed.success) {
      RpcTracer.error(rootSpan.id, { signature, error: confirmed.error });
      console.error("Transaction failed or expired", confirmed.error);
      return {
        success: false,
        data: signature,
        error: confirmed.error ?? "Transaction confirmation failed",
      }
    } else {
      RpcTracer.success(rootSpan.id, { signature });
      console.log("Transaction confirmed", signature);
      return {
        success: true,
        data: signature,
      }
    }
  }

  /**
   * NOTE: for future me
    polls getSignatureStatuses() instead of confirmTransaction(), 
    which crashes in MV3 service workers because it uses window object internally
    for a websocket connection. (error window is not defined)
   **/
  // TODO: implement transaction mannager that will track a queue of pending transactions
  // in indexdb, and then a background process will do the polling and update the status of transaction in queue, so that we can show pending/confirmed/failed status in UI without relying on user to keep the tab open until transaction is confirmed.
  private static async pollForConfirmation(
    signature: string,
    lastValidBlockHeight: number,
    intervalMs = 2000
  ): Promise<{ success: boolean; error?: string }> {
    const rootSpan = RpcTracer.start("POLL_CONFIRMATION_FLOW", { signature, lastValidBlockHeight });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };

    while (true) {
      RpcTracer.addEvent(rootSpan.id, "Polling getSignatureStatuses");
      const { value } = await RpcService.getSignatureStatuses([signature], ctx);
      const status = value?.[0];

      if (status) {
        if (status.err) {
          RpcTracer.error(rootSpan.id, { signature, error: status.err });
          return { success: false, error: JSON.stringify(status.err) };
        }
        // Consider "confirmed" or "finalized" as success
        if (
          status.confirmationStatus === "confirmed" ||
          status.confirmationStatus === "finalized"
        ) {
          RpcTracer.success(rootSpan.id, { signature });
          return { success: true };
        }
      }

      // Check if the blockhash has expired
      RpcTracer.addEvent(rootSpan.id, "Checking block height for expiration");
      const blockHeight = await RpcService.getBlockHeight(ctx);
      if (blockHeight > lastValidBlockHeight) {
        RpcTracer.error(rootSpan.id, "Transaction expired: block height exceeded lastValidBlockHeight");
        return {
          success: false,
          error: "Transaction expired: block height exceeded lastValidBlockHeight",
        };
      }

      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  // --- Wallet Standard methods ---

  static async signAndSendTransaction(tx: number[], password: string): Promise<string> {
    const rootSpan = RpcTracer.start("STANDARD : signAndSendTransaction", { tx, password: "****" });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };

    const transaction = Transaction.from(tx);
    RpcTracer.addEvent(rootSpan.id, "VAULT : Signing transaction");
    const signedTx = await this.signTransaction(transaction, password);
    RpcTracer.addEvent(rootSpan.id, "Sending Raw transaction");
    const signature = await RpcService.sendRawTransaction(signedTx, ctx);
    RpcTracer.success(rootSpan.id, { signature });
    return signature;
  }

  static async simulateTransactionUsingTransaction(tx: number[], password: string): Promise<MessageResponse<"SIMULATE_USING_TRANSACTION">> {
    const rootSpan = RpcTracer.start("SIMULATE_TRANSACTION_FLOW", { tx, password: "****" });
    try {
      const ctx = {
        traceId: rootSpan.traceId,
        parentId: rootSpan.id,
      };
      const transaction = Transaction.from(tx);
      RpcTracer.addEvent(rootSpan.id, "VAULT : Signing transaction");
      const signedTx = await this.signTransaction(transaction, password);
      const config: SimulateTransactionConfig = { commitment: "confirmed" }
      RpcTracer.addEvent(rootSpan.id, "Simulating transaction");
      const simulation = await RpcService.simulateTransaction(signedTx, config, ctx);

      RpcTracer.success(rootSpan.id, simulation);
      console.log("Simulation result:", simulation)
      return {
        success: true,
        data: simulation.value,
      }
    } catch (error) {
      RpcTracer.error(rootSpan.id, error);
      console.error("Simulation failed transaction.service:", error);
      throw new Error(`Simulation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async signAllTransactions(txs: number[][], password: string): Promise<Transaction[]> {
    const rootSpan = RpcTracer.start("STANDARD : signAllTransactions", { count: txs.length, password: "****" });

    const signedTxs: Transaction[] = [];
    RpcTracer.addEvent(rootSpan.id, "Signing all transactions");
    for (const tx of txs) {
      const transaction = Transaction.from(tx);
      const signedTx = await this.signTransaction(transaction, password);
      signedTxs.push(signedTx);
    }
    RpcTracer.success(rootSpan.id, { count: signedTxs.length });
    return signedTxs;
  }

  static async simulateTransactionUsingTransactions(txs: number[][], password: string): Promise<MessageResponse<"SIMULATE_USING_TRANSACTIONS">> {
    const rootSpan = RpcTracer.start("SIMULATE_TRANSACTIONS_FLOW", { count: txs.length, password: "****" });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };
    try {
      const signedTxs = await this.signAllTransactions(txs, password);
      const config: SimulateTransactionConfig = { commitment: "confirmed" }
      const simulations = [];
      for (const signedTx of signedTxs) {
        const simulation = await RpcService.simulateTransaction(signedTx, config, ctx);
        simulations.push(simulation.value);
      }

      RpcTracer.success(rootSpan.id, { count: simulations.length });
      console.log("Simulations result:", simulations)
      return {
        success: true,
        data: simulations,
      }
    } catch (error) {
      RpcTracer.error(rootSpan.id, String(error));
      throw new Error(`Simulation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async signMessage(message: number[], password: string): Promise<{ signature: number[] }> {
    const rootSpan = RpcTracer.start("STANDARD : signMessage", { length: message.length, password: "****" });
    try {
      const uintMessage = new Uint8Array(message);

      const signature = await vaultService.singMessage(uintMessage, password);

      RpcTracer.success(rootSpan.id, { signature: "ok" });
      return {
        signature: Array.from(signature.signature)
      };
    } catch (error) {
      RpcTracer.error(rootSpan.id, String(error));
      throw new Error(`Sign message failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async signIn(input: string, password: string): Promise<{
    account: {
      address: string,
      publicKey: number[],
      chains: typeof chains,
      features: typeof features
    },
    signedMessage: number[],
    signature: number[],
  }> {
    const rootSpan = RpcTracer.start("STANDARD : signIn", { inputLength: input.length, password: "****" });
    try {
      const signature = await vaultService.signIn(input, password);
      const pubkey = (await vaultService.getActiveAccount()).pubkey;

      RpcTracer.success(rootSpan.id, { address: pubkey });
      return {
        account: {
          address: pubkey,
          publicKey: Array.from(bs58.decode(pubkey)),
          chains: chains,
          features: features,
        },
        signedMessage: Array.from(new TextEncoder().encode(input)),
        signature: Array.from(signature.signature)
      };
    } catch (error) {
      RpcTracer.error(rootSpan.id, String(error));
      throw new Error(`Sign in failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // --- Token transfer methods ---

  static async simulateTransferTokens(
    mint: string,
    destination: string,
    amount: number,
    password: string
  ) {
    const rootSpan = RpcTracer.start("TOKEN : simulateTransferTokens", { mint, destination, amount, password: "****" });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };
    try {
      const activeAccount = await vaultService.getActiveAccount();

      const mintPubkey = new PublicKey(mint);

      RpcTracer.addEvent(rootSpan.id, "Get ATA for source ");
      const myTokenAccount = await RpcService.getAssociatedTokenAddress(
        mintPubkey,
        new PublicKey(activeAccount.pubkey),
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        ctx
      );

      RpcTracer.addEvent(rootSpan.id, "Get ATA for destination");
      const destinationTokenAccount = await RpcService.getAssociatedTokenAddress(
        mintPubkey,
        new PublicKey(destination),
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
        ctx
      );

      RpcTracer.addEvent(rootSpan.id, "Creating transfer instruction");
      const ix = await RpcService.createTransferInstruction(
        myTokenAccount,
        destinationTokenAccount,
        new PublicKey(activeAccount.pubkey),
        amount,
        [],
        TOKEN_PROGRAM_ID,
        ctx
      );
      const tx = new Transaction().add(ix);
      RpcTracer.addEvent(rootSpan.id, "Fetching blockhash");
      const { blockhash } = await RpcService.getLatestBlockhash(ctx);
      tx.feePayer = new PublicKey(activeAccount.pubkey);
      tx.recentBlockhash = blockhash;

      RpcTracer.addEvent(rootSpan.id, "VAULT : Signing transaction");
      const signedTx = await this.signTransaction(tx, password);
      const txArray = signedTx.serialize();
      RpcTracer.addEvent(rootSpan.id, "Simulating transaction Flow");
      const sim = await this.simulateTransactionUsingTransaction(Array.from(txArray), password);
      RpcTracer.success(rootSpan.id, sim);
      return sim;
    } catch (error) {
      RpcTracer.error(rootSpan.id, error);
      console.error("Simulate transfer tokens failed:", error);
      throw new Error(`Simulate transfer tokens failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async transferTokens(
    mint: string,
    destination: string,
    amount: number,
    password: string
  ) {
    const rootSpan = RpcTracer.start("TOKEN : transferTokens", { mint, destination, amount, password: "****" });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };
    try {
      const activeAccount = await vaultService.getActiveAccount();
      RpcTracer.addEvent(rootSpan.id, "Fetching or creating source token account");
      const myTokenAccount = await this.getOrCreateAssociatedTokenAccount(
        new PublicKey(activeAccount.pubkey), // payer, in ata creation if not exists
        new PublicKey(mint),
        new PublicKey(activeAccount.pubkey), // owner
        password
      );
      RpcTracer.addEvent(rootSpan.id, "Fetching or creating destination token account");
      const destinationTokenAccount = await this.getOrCreateAssociatedTokenAccount(
        new PublicKey(activeAccount.pubkey), // payer, in ata creation if not exists - we can use anyone as payer, using active account for simplicity
        new PublicKey(mint),
        new PublicKey(destination), // owner
        password
      );

      const source = myTokenAccount.address;
      const dest = destinationTokenAccount.address;
      const ownerPublicKey = new PublicKey(activeAccount.pubkey);
      const programId = TOKEN_PROGRAM_ID;
      RpcTracer.addEvent(rootSpan.id, "Fetching blockhash");
      const { blockhash, lastValidBlockHeight } = await RpcService.getLatestBlockhash(ctx);
      RpcTracer.addEvent(rootSpan.id, "Creating transfer instruction");
      const instruction = await RpcService.createTransferInstruction(
        source,
        dest,
        ownerPublicKey,
        amount,
        [],
        programId,
        ctx
      );
      const transaction = new Transaction().add(instruction);
      transaction.feePayer = new PublicKey(activeAccount.pubkey);
      transaction.recentBlockhash = blockhash;

      RpcTracer.addEvent(rootSpan.id, "VAULT : Signing transaction");
      const signedTx = await this.signTransaction(transaction, password);
      RpcTracer.addEvent(rootSpan.id, "Sending transaction");
      const signature = await RpcService.sendRawTransaction(signedTx, ctx);
      RpcTracer.addEvent(rootSpan.id, "Polling for confirmation");
      const confirmed = await this.pollForConfirmation(
        signature,
        lastValidBlockHeight
      )

      if (!confirmed.success) {
        RpcTracer.error(rootSpan.id, { signature, error: confirmed.error });
        console.error("Transaction failed or expired", confirmed.error);
        return {
          success: false,
          data: signature,
          error: confirmed.error ?? "Transaction confirmation failed",
        }
      } else {
        RpcTracer.success(rootSpan.id, { signature });
        console.log("Transaction confirmed", signature);
        return {
          success: true,
          data: signature,
        }
      }
    } catch (error) {
      RpcTracer.error(rootSpan.id, String(error));
      console.error("Transfer tokens failed:", error);
      throw new Error(`Transfer tokens failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async getOrCreateAssociatedTokenAccount(payer: PublicKey, mint: PublicKey, owner: PublicKey, password: string, commitment?: Commitment): Promise<Account> {
    const rootSpan = RpcTracer.start("TOKEN : getOrCreateAssociatedTokenAccount", { payer: payer.toBase58(), mint: mint.toBase58(), owner: owner.toBase58() });
    const ctx = {
      traceId: rootSpan.traceId,
      parentId: rootSpan.id,
    };

    const programId = TOKEN_PROGRAM_ID;
    const associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID;
    const allowOwnerOffCurve = false;
    RpcTracer.addEvent(rootSpan.id, "Get ATA for owner");
    const associatedToken = await RpcService.getAssociatedTokenAddress(
      mint,
      owner,
      allowOwnerOffCurve,
      programId,
      associatedTokenProgramId,
      ctx
    );

    let account: Account;
    try {
      RpcTracer.addEvent(rootSpan.id, "Get ATA account info");
      account = await RpcService.getAccount(associatedToken, commitment, programId, ctx);
    } catch (error: unknown) {
      if (error instanceof TokenAccountNotFoundError || error instanceof TokenInvalidAccountOwnerError) {
        try {
          RpcTracer.addEvent(rootSpan.id, "Creating ATA instruction");
          const instruction = await RpcService.createAssociatedTokenAccountInstruction(
            payer,
            associatedToken,
            owner,
            mint,
            programId,
            associatedTokenProgramId,
            ctx
          );
          const transaction = new Transaction().add(instruction);

          RpcTracer.addEvent(rootSpan.id, "Fetching blockhash");
          const { blockhash, lastValidBlockHeight } = await RpcService.getLatestBlockhash(ctx);
          transaction.recentBlockhash = blockhash
          transaction.feePayer = new PublicKey(payer)

          RpcTracer.addEvent(rootSpan.id, "VAULT : Signing transaction");
          const signedTx = await this.signTransaction(transaction, password)
          RpcTracer.addEvent(rootSpan.id, "Sending transaction");
          const signature = await RpcService.sendRawTransaction(signedTx, ctx)

          RpcTracer.addEvent(rootSpan.id, "Polling for confirmation");
          await this.pollForConfirmation(
            signature,
            lastValidBlockHeight
          )
        } catch (error: unknown) {
          RpcTracer.error(rootSpan.id, String(error));
          console.error("Failed to create associated token account:", error);
        }

        RpcTracer.addEvent(rootSpan.id, "Getting ATA account info");
        account = await RpcService.getAccount(associatedToken, commitment, programId, ctx);
      } else {
        RpcTracer.error(rootSpan.id, String(error));
        throw error;
      }
    }

    if (!account.mint.equals(mint)) throw new TokenInvalidMintError();
    if (!account.owner.equals(owner)) throw new TokenInvalidOwnerError();

    RpcTracer.success(rootSpan.id, { address: associatedToken.toBase58() });
    return account;
  }

}