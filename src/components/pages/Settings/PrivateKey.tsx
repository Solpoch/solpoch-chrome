import { CopyIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import { useAccountStore } from "../../../store";
import ProfileAvatar from "../../ui/home/ProfileAvatar";
import SafeArea from "../../ui/layout/SafeArea";
import BackButton from "../../ui/util/BackButton";
import { StarFourIcon } from "@phosphor-icons/react/dist/ssr";
import { useState } from "react";
import ConfirmWithPassword from "../../ui/util/ConfirmWithPassword";
import { sendMessage } from "../../../lib/utils/chrome/message";

export default function PrivateKey() {

  const account = useAccountStore((state) => state.account);
  const [isKeyCopied, setIsKeyCopied] = useState(false);
  const [coping, setCopying] = useState(false);

  const [password, setPassword] = useState<string>("");
  const [confimedWithPassword, setConfimedWithPassword] = useState(false);


  const handleCopyKey = async () => {
    if (!account) return;
    setCopying(true);
    const privateKey = await sendMessage("GET_PRIVATE_KEY", {
      index: account.index,
      password,
    });
    await navigator.clipboard.writeText(privateKey);
    setCopying(false);
    setIsKeyCopied(true);
    setTimeout(() => setIsKeyCopied(false), 2000);

    // clear the clipboard after 15 sec for security
    setTimeout(() => {
      navigator.clipboard.writeText("");
    }, 15 * 1000);
  };

  if (!confimedWithPassword) {
    return (
      <SafeArea>
        <div className="p-6 h-full">
          <ConfirmWithPassword
            password={password}
            setPassword={setPassword}
            setConfimedWithPassword={setConfimedWithPassword}
          />
        </div>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <div className="p-6">
        <div className="flex justify-between items-center sticky top-0 z-10 bg-transparent backdrop-blur-sm pb-6">
          <BackButton />
          <ProfileAvatar account={account} accountLoading={false} />
        </div>

        <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-500/10 p-4">
          <div className="flex items-start gap-2">
            <ShieldWarningIcon size={14} weight="fill" className="text-amber-300 mt-0.5" />
            <div>
              <p className="text-sm text-amber-200 font-medium">Security Warning</p>
              <p className="mt-1 text-xs text-amber-100/90 leading-relaxed">
                Your private key gives full control of this account.
                {" "}
                <span className="font-medium">
                  A{account?.index} ({account?.pubkey.slice(0, 4)}...{account?.pubkey.slice(-4)})
                </span>
                . Never share it or paste it into websites.
              </p>
            </div>
          </div>
        </div>

        <h4 className="text-xs text-gray-400 mt-6 uppercase tracking-wide">
          Private Key for Account A{account?.index}
        </h4>
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3">
          <div className="flex flex-wrap gap-1.5 font-mono text-sm text-gray-300 justify-center items-center">
            {
              `************************`.split("").map((_, index) => (
                <span
                  key={index}
                  className="inline-flex h-5 w-5 items-center justify-center rounded "
                >
                  <StarFourIcon size={10} weight="fill" className="text-gray-400" />
                </span>
              ))
            }
          </div>

          <button
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-70"
            onClick={handleCopyKey}
            disabled={coping}
          >
            <CopyIcon size={14} />
            <span>{coping ? "Copying private key..." : isKeyCopied ? "Private key copied" : "Copy Private Key"}</span>
          </button>

          <p className="mt-4 text-xs text-gray-400 text-center">
            Clipboard contents can be read by other apps. Auto cleared after 15 seconds for security.
          </p>
        </div>


      </div>
    </SafeArea>
  )
}