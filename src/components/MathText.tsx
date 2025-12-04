import { useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";

type MathTextProps = {
  expression: string;
  className?: string;
  displayMode?: boolean;
  ariaLabel?: string;
};

export function MathText({
  expression,
  className,
  displayMode = false,
  ariaLabel,
}: MathTextProps) {
  const rendered = useMemo(() => {
    try {
      return katex.renderToString(expression, {
        throwOnError: false,
        displayMode,
        strict: "ignore",
      });
    } catch (error) {
      console.error("Unable to render math expression", error);
      return expression;
    }
  }, [expression, displayMode]);

  return (
    <span
      className={className}
      aria-label={ariaLabel}
      role={ariaLabel ? "text" : undefined}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
