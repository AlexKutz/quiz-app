import React, { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

const Confetti = ({ duration = 15000, particleCount = 50, onComplete }) => {
  const intervalRef = useRef(null);

  useEffect(() => {
    const animationEnd = Date.now() + duration;
    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
    };

    function randomInRange(min, max) {
      return Math.random() * (max - min) + min;
    }

    intervalRef.current = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(intervalRef.current);
        if (onComplete) {
          onComplete();
        }
        return;
      }

      const currentParticleCount = particleCount * (timeLeft / duration);

      // Launch confetti from left side
      confetti({
        ...defaults,
        particleCount: currentParticleCount,
        origin: {
          x: randomInRange(0.1, 0.3),
          y: Math.random() - 0.2,
        },
      });

      // Launch confetti from right side
      confetti({
        ...defaults,
        particleCount: currentParticleCount,
        origin: {
          x: randomInRange(0.7, 0.9),
          y: Math.random() - 0.2,
        },
      });
    }, 250);

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [duration, particleCount, onComplete]);

  // This component doesn't render anything visible
  return null;
};

export default Confetti;
