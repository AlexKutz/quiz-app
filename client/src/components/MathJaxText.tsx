import React, { useEffect, useRef } from "react";

interface MathJaxTextProps {
  children: React.ReactNode;
  className?: string;
}

const MathJaxText: React.FC<MathJaxTextProps> = ({
  children,
  className = "",
}) => {
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if ((window as any).MathJax && textRef.current) {
      (window as any).MathJax.typesetPromise([textRef.current]).catch(
        (err: any) => {
          console.error("MathJax typesetting error:", err);
        }
      );
    }
  }, [children]);

  return (
    <span ref={textRef} className={className}>
      {children}
    </span>
  );
};

export default MathJaxText;
