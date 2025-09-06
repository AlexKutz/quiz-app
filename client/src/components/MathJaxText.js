import React, { useEffect, useRef } from 'react';

const MathJaxText = ({ children, className = '' }) => {
  const textRef = useRef(null);

  useEffect(() => {
    if (window.MathJax && textRef.current) {
      window.MathJax.typesetPromise([textRef.current]).catch((err) => {
        console.error('MathJax typesetting error:', err);
      });
    }
  }, [children]);

  return (
    <span ref={textRef} className={className}>
      {children}
    </span>
  );
};

export default MathJaxText;
