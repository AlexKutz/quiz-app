import React from "react";

interface ArrowIconProps {
  onClick: () => void;
  className?: string;
}

const ArrowIcon: React.FC<ArrowIconProps> = ({ onClick, className }) => {
  return (
    <button onClick={onClick} className={className}>
      ←
    </button>
  );
};

export { ArrowIcon };
