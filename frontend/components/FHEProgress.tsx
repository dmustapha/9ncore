"use client";

type FHEProgressProps = {
  active: boolean;
  message?: string;
};

export default function FHEProgress({ active, message }: FHEProgressProps) {
  if (!active) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-fhe-dark border border-fhe-purple/40 rounded-2xl p-8 max-w-sm w-full mx-4 text-center shadow-2xl">
        <div className="flex justify-center mb-4">
          <div className="w-14 h-14 border-4 border-fhe-purple border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-white font-semibold text-lg mb-1">
          FHE Computation in Progress
        </p>
        <p className="text-gray-400 text-sm">
          {message ?? "Your transaction is being processed by the Zama coprocessor. This may take 10-30 seconds."}
        </p>
        <p className="text-fhe-purple text-xs mt-4 font-mono">
          homomorphic encryption active
        </p>
      </div>
    </div>
  );
}
