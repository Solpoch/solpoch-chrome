import { useNavigate } from "react-router-dom";
import { useAccountStore } from "../../../store";
import SafeArea from "../layout/SafeArea";
import { CaretLeftIcon } from "@phosphor-icons/react";
import ProfileAvatar from "../home/ProfileAvatar";
import AddressCopyButton from "../util/AddressWithCopyButton";

export default function TransactionDetails() {

  const account = useAccountStore((state) => state.account);
  const navigate = useNavigate();

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
        <div>
          transaction details, state changes, view in explorer etc. can be shown here, copy signature.
          <AddressCopyButton addressToCopy="0x1234567890abcdef1234567890abcdef12345678" />
        </div>
      </div>
    </SafeArea>
  )
}