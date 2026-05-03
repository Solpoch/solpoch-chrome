import { Transaction, VersionedTransaction, type SendOptions } from "@solana/web3.js";
import { useAccountStore } from "../../../store";
import ProfileAvatar from "../home/ProfileAvatar";
import SafeArea from "../layout/SafeArea";
import type { SolanaSignInInput } from "@solana/wallet-standard-features";
import { CodeIcon } from "@phosphor-icons/react";
import JsonView from '@uiw/react-json-view';
import { vscodeTheme } from '@uiw/react-json-view/vscode';

function deserializeTx(bytes: Uint8Array) {
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

type DappPayloadMap = {
  signAndSendTransaction: {
    transaction: number[]; // serialized transaction in bytes
    options?: SendOptions;
  };
  signTransaction: {
    transaction: number[]; // serialized transaction in bytes
  };
  signAllTransactions: {
    transactions: number[][]; // array of serialized transactions in bytes
  };
  signMessage: {
    message: Uint8Array;
  };
  signIn: SolanaSignInInput;
};

type Method = keyof DappPayloadMap;

export default function ShowDappPayload({
  method,
  parameters,
  toggleShowDappPayload,
  showDappPayload,
}: {
  method: Method;
  parameters: DappPayloadMap[Method];
  toggleShowDappPayload: () => void;
  showDappPayload: boolean;
}) {
  const account = useAccountStore((state) => state.account);


  return (
    <SafeArea>
      <div className="flex flex-col h-full p-6">
        {/* Header */}
        <div className="flex justify-between items-center sticky top-0 z-10 bg-transparent backdrop-blur-sm pb-6">
          <ProfileAvatar account={account} accountLoading={false} />
          <button
            onClick={toggleShowDappPayload}
            className={`flex items-center gap-1 rounded-full p-2 justify-center ${showDappPayload ? "bg-primary" : "bg-white/10"}`}
          >
            <CodeIcon size={14} weight="bold" className={`${showDappPayload ? "text-white" : "text-gray-400"}`} />
          </button>
        </div>
        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scrollbar-hide flex flex-col gap-3 pb-6">

          {/* parsed payload view */}
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/50">Dapp Request Payload</div>
                <div className="mt-1 text-xs text-white/70">Method: <span className="font-medium text-white">{method}</span></div>
              </div>
              <div className="rounded-full border border-white/5 bg-white/5 px-3 py-1 text-[10px] font-medium text-white/60">
                Parsed
              </div>
            </div>

            <div className="mt-4">
              <JsonView value={useParsedDappPayload(method, parameters).parsed} style={vscodeTheme} className="rounded-md text-xs p-4" />
            </div>

          </div>

        </div>

      </div>
    </SafeArea >
  )
}

function parsePayload(method: Method, parameters: DappPayloadMap[Method]): {
  raw: DappPayloadMap[Method];
  parsed: any;
} {
  switch (method) {
    case "signAndSendTransaction": {
      let params = parameters as DappPayloadMap["signAndSendTransaction"]
      return {
        raw: params,
        parsed: {
          _transaction: deserializeTx(new Uint8Array(params.transaction)),
          _options: params.options
        }
      }
    }
    case "signTransaction": {
      let params = parameters as DappPayloadMap["signTransaction"]
      return {
        raw: params,
        parsed: {
          _transaction: deserializeTx(new Uint8Array(params.transaction))
        }
      }
    }
    case "signAllTransactions": {
      let params = parameters as DappPayloadMap["signAllTransactions"]
      return {
        raw: params,
        parsed: {
          _transactions: params.transactions.map((tx) => deserializeTx(new Uint8Array(tx)))
        }
      }
    }
    default:
      return {
        raw: parameters,
        parsed: parameters
      }
  }
};

export function useParsedDappPayload(method: Method, params: DappPayloadMap[Method]) {
  const parsedParams = parsePayload(method, params);
  return parsedParams;
}