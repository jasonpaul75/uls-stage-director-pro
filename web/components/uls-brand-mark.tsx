/** Compact mark for shell headers — pair with product name (spec: black / gold / white). */
export function UlsBrandMark(props: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      width={40}
      height={26}
      className={props.className}
      aria-hidden
    >
      <rect x="1" y="1" width="46" height="30" rx="4" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500/90" />
      <text
        x="24"
        y="21"
        textAnchor="middle"
        fontFamily="Arial, Helvetica, sans-serif"
        fontSize="12"
        fontWeight="700"
        fill="currentColor"
        className="text-amber-500"
      >
        ULS
      </text>
    </svg>
  );
}
