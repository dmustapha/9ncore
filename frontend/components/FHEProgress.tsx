"use client";

type FHEProgressProps = {
  active: boolean;
  message?: string;
};

export default function FHEProgress({ active, message }: FHEProgressProps) {
  if (!active) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(7,7,13,0.7)] backdrop-blur-sm flex items-center justify-center z-50">
      <div className="panel max-w-sm w-full mx-4 text-center shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-[#E8EAF0] font-semibold text-base mb-1">
          FHE Computation in Progress
        </p>
        <p className="text-[#9CA3AF] text-sm leading-relaxed">
          {message ?? "Your transaction is being processed by the Zama coprocessor. This may take 10–30 seconds."}
        </p>
        <p className="text-teal font-mono text-xs mt-4">
          homomorphic encryption active
        </p>
      </div>
    </div>
  );
}
