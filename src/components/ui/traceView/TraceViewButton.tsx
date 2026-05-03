import { ArrowRightIcon } from "@phosphor-icons/react";

export default function TraceViewButton({
  success,
  proceed,
  loading,
}: {
  success: boolean;
  proceed: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!loading) {
          console.log("Proceeding to next step");
          proceed();
        }
      }}
      className={`flex items-center justify-center gap-2 px-4 py-2.5  hover:gap-4 disabled:opacity-40 disabled:cursor-not-allowed transition-all rounded-full font-medium w-full text-xs ${success
        ? "bg-primary hover:bg-primary/90 text-white inset-top"
        : "border-rose-400/30 bg-rose-400/10 text-rose-300 hover:bg-rose-400/15"
        }`}
      disabled={loading}
    >
      {loading ? "Processing..." : success ? "Proceed Next" : "View Error Details"}
      {!loading && <ArrowRightIcon size={14} />}
    </button>
  );
}
