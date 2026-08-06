type ScanCounterProps = {
  total: number;
  isAnimating: boolean;
};

export function ScanCounter({ total, isAnimating }: ScanCounterProps) {
  const previousTotal = isAnimating ? Math.max(0, total - 1) : total;
  const width = Math.max(2, String(previousTotal).length, String(total).length);
  const previousDigits = String(previousTotal).padStart(width, "0").split("");
  const digits = String(total).padStart(width, "0").split("");

  return (
    <div
      className={`scan-counter ${isAnimating ? "is-counting" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={`${total} barcodes scanned in this project`}
    >
      <span className="scan-counter-digits" aria-hidden="true">
        {digits.map((digit, index) => {
          const previousDigit = previousDigits[index];
          const isChanging = isAnimating && previousDigit !== digit;

          return (
            <span
              className={`scan-counter-digit ${isChanging ? "is-rolling" : ""}`}
              key={index}
            >
              {isChanging ? (
                <span className="scan-counter-reel">
                  <span>{previousDigit}</span>
                  <span>{digit}</span>
                </span>
              ) : (
                <span className="scan-counter-value">{digit}</span>
              )}
            </span>
          );
        })}
      </span>
      <span className="scan-counter-label" aria-hidden="true">scanned</span>
    </div>
  );
}
