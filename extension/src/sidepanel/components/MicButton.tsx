import { Mic, Square } from "lucide-react";

interface Props {
  isListening: boolean;
  disabled?: boolean;
  onStart: () => void;
  onStop: () => void;
}

export function MicButton({ isListening, disabled, onStart, onStop }: Props) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={isListening ? onStop : onStart}
      aria-label={isListening ? "Stop recording" : "Start talking"}
      style={{
        position: "relative",
        width: 64,
        height: 64,
        borderRadius: "var(--radius-full)",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: isListening ? "var(--danger)" : "var(--accent-gradient)",
        opacity: disabled ? 0.5 : 1,
        boxShadow: isListening
          ? "0 0 0 0 rgba(242, 139, 130, 0.5)"
          : "0 4px 14px rgba(140, 158, 255, 0.35)",
        animation: isListening ? "mic-pulse 1.6s ease-out infinite" : "none",
        transition: "background 0.15s ease",
      }}
    >
      {isListening ? (
        <Square size={22} color="#131314" fill="#131314" />
      ) : (
        <Mic size={26} color="#131314" />
      )}
      <style>{`
        @keyframes mic-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(242, 139, 130, 0.55); }
          70%  { box-shadow: 0 0 0 16px rgba(242, 139, 130, 0); }
          100% { box-shadow: 0 0 0 0 rgba(242, 139, 130, 0); }
        }
      `}</style>
    </button>
  );
}
