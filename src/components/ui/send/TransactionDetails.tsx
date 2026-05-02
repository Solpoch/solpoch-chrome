import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowRightIcon, CaretLeftIcon, CheckCircleIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useAccountStore } from "../../../store";
import SafeArea from "../layout/SafeArea";
import ProfileAvatar from "../home/ProfileAvatar";
import SectionCard from "../popup/signAndSendTransaction/SectionCard";
import Row from "../popup/signAndSendTransaction/Row";
import AiCrad from "../layout/AiCrad";
import { RpcServiceContent } from "../../../lib/rpc/content";
import { API_ROUTES } from "../../../lib/http/api";
import type { RpcSpan } from "../../../lib/rpc/tracer";
import { lamportsToSol } from "../../../lib/utils/solana/conversion";
import { shortAddress } from "../../../lib/utils/solana/parse";

export default function TransactionDetails() {
  const location = useLocation();
  const state = (location.state ?? null) as {
    signature?: string | null;
    traces?: RpcSpan[];
    toAddress?: string;
    amount?: string;
  } | null;

  const signature = state?.signature ?? null;
  const traces = state?.traces ?? [];
  const amount = state?.amount ?? "";
  const toAddress = state?.toAddress ?? "";

  const account = useAccountStore((state) => state.account);
  const navigate = useNavigate();
  const [remainingMs, setRemainingMs] = useState(KEEP_VIEWING_DURATION_MS);
  const [showDoneButton, setShowDoneButton] = useState(false);
  const timerIdRef = useRef<number | null>(null);

  const transactionDetailsFromRpcQuery = useQuery({
    queryKey: ["transactionDetails", signature],
    queryFn: async () => {
      if (!signature) return null;
      return await RpcServiceContent.getTransaction(signature);
    },
    enabled: !!signature,
  });

  const {
    data: aiExplanation,
    isLoading: isAiExplanationLoading,
    isError: isAiExplanationError,
  } = useQuery({
    queryKey: ["aiExplanation", "transaction-details", signature],
    queryFn: async () => {
      if (signature) return null;

      const context = `
        Transaction error: Missing signature.
        Traces: ${JSON.stringify(traces)}
        Sender: ${account?.pubkey ?? "Unknown"}
        Recipient: ${toAddress || "Unknown"}
        Amount: ${amount || "Unknown"} SOL
        Network: Devnet
      `;

      const res = await axios.post(API_ROUTES.ai.explainSimulationError, {
        results: context,
      });

      return res.data;
    },
    enabled: !signature && traces.length > 0,
    staleTime: 0,
    gcTime: 0,
    meta: {
      persist: false,
    },
  });

  useEffect(() => {
    if (showDoneButton) {
      if (timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
      return;
    }

    const start = performance.now();
    timerIdRef.current = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const nextRemaining = Math.max(KEEP_VIEWING_DURATION_MS - elapsed, 0);
      setRemainingMs(nextRemaining);

      if (nextRemaining <= 0 && timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
        timerIdRef.current = null;
        navigate("/");
      }
    }, 50);

    return () => {
      if (timerIdRef.current !== null) {
        window.clearInterval(timerIdRef.current);
        timerIdRef.current = null;
      }
    };
  }, [navigate, showDoneButton]);

  const balanceChanges = useMemo(() => {
    const details = transactionDetailsFromRpcQuery.data;
    const keys = details?.transaction?.message?.accountKeys ?? [];
    const preBalances = details?.meta?.preBalances ?? [];
    const postBalances = details?.meta?.postBalances ?? [];

    return keys
      .map((key, index) => {
        const address =
          (key as { pubkey?: { toBase58?: () => string } })?.pubkey?.toBase58?.() ??
          (key as { toBase58?: () => string })?.toBase58?.() ??
          String(key);
        const preLamports = preBalances[index] ?? 0;
        const postLamports = postBalances[index] ?? 0;
        const deltaLamports = postLamports - preLamports;

        return {
          address,
          preLamports,
          postLamports,
          deltaLamports,
        };
      })
      .filter((change) => change.deltaLamports !== 0);
  }, [transactionDetailsFromRpcQuery.data]);

  return (
    <SafeArea>
      <div className="flex flex-col h-full p-6">
        {/* header */}
        <div className="flex justify-between items-center sticky top-0 z-10 bg-transparent backdrop-blur-sm pb-6">
          <button className="flex bg-white/10 items-center gap-1 rounded-full p-2 justify-center" onClick={() => navigate(-1)}>
            <CaretLeftIcon size={16} weight="bold" className="text-gray-200" />
          </button>
          <ProfileAvatar account={account} accountLoading={false} />
        </div>
        {/* body */}
        <div className="flex flex-col gap-4 h-full justify-center">
          <div className="flex flex-col items-center gap-2">
            {signature ? (
              <span className="flex bg-green-500/10 rounded-full p-2">
                <CheckCircleIcon size={32} weight="fill" className="text-green-500" />
              </span>
            ) : (
              <span className="flex bg-rose-500/10 rounded-full p-2">
                <WarningCircleIcon size={32} weight="fill" className="text-rose-400" />
              </span>
            )}
            <p className="text-xs text-gray-300">
              {signature ? "Transaction sent" : "Transaction failed"}
            </p>
          </div>

          {signature && (
            <SectionCard>
              <Row
                label="Signature"
                value={shortAddress(signature)}
                mono
                accent="neutral"
                canCopyValue={true}
              />
              <div className="px-3 pb-3 pt-1">
                <a
                  href={`https://explorer.solana.com/tx/${signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary"
                >
                  View on Solana Explorer <ArrowRightIcon size={12} weight="bold" className="inline-block ml-1 mt-1" />
                </a>
              </div>
            </SectionCard>
          )}

          {!signature && !isAiExplanationError && traces.length > 0 && (
            <AiCrad loading={isAiExplanationLoading} content={aiExplanation} />
          )}

          {signature && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-gray-500">State changes</p>
              <SectionCard>
                {transactionDetailsFromRpcQuery.isLoading && (
                  <div className="px-3 py-3 text-xs text-gray-500">Loading transaction state...</div>
                )}
                {!transactionDetailsFromRpcQuery.isLoading && balanceChanges.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-500">No balance changes found.</div>
                )}
                {balanceChanges.map((change) => (
                  <div key={change.address} className="px-3 py-2.5 border-t border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-mono text-gray-200 truncate">{shortAddress(change.address)}</p>
                      <p className={`text-xs font-semibold ${change.deltaLamports < 0 ? "text-rose-300" : "text-green-300"}`}>
                        {change.deltaLamports < 0 ? "" : "+"}
                        {lamportsToSol(change.deltaLamports).toFixed(6)} SOL
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-gray-500">
                      <span>Pre: {lamportsToSol(change.preLamports).toFixed(6)} SOL</span>
                      <span>Post: {lamportsToSol(change.postLamports).toFixed(6)} SOL</span>
                    </div>
                  </div>
                ))}
              </SectionCard>
            </div>
          )}

          <div className="pt-2">
            {showDoneButton ? (
              <button
                type="button"
                onClick={() => navigate("/")}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white/7 hover:bg-white/11 transition-colors rounded-full text-white font-medium w-full text-xs"
              >
                Done
              </button>
            ) : (
              <KeepViewingButton remainingMs={remainingMs} onClick={() => setShowDoneButton(true)} />
            )}
          </div>
        </div>
      </div>
    </SafeArea>
  )
}

const KEEP_VIEWING_DURATION_MS = 5000;

function formatKeepViewingCountdown(durationMs: number) {
  const seconds = Math.max(durationMs, 0) / 1000;
  return seconds.toFixed(2).replace(".", ":");
}

function KeepViewingButton({
  remainingMs,
  onClick,
}: {
  remainingMs: number;
  onClick: () => void;
}) {
  const progress = Math.min(Math.max(remainingMs / KEEP_VIEWING_DURATION_MS, 0), 1);

  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center justify-center gap-2 overflow-hidden rounded-full border border-white/10 bg-primary/30 px-4 py-2.5 text-xs font-medium text-white transition-all disabled:cursor-not-allowed disabled:opacity-40 w-full"
    >
      <span
        className="absolute left-0 top-0 h-full bg-primary transition-[width] duration-75"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative z-10">Keep viewing ({formatKeepViewingCountdown(remainingMs)})</span>
    </button>
  );
}