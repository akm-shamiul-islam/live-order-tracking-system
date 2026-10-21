import { MotionConfig, LazyMotion, domAnimation, useReducedMotion } from 'motion/react';
import * as m from 'motion/react-m';
import { CourierMarker, MARKER_CLASS } from './CourierMarker';

export default function AnimatedCourierBeacon({ x, y }: { x: number; y: number }) {
  const reduced = useReducedMotion();
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <m.div
          data-courier-beacon
          className={MARKER_CLASS}
          animate={{ left: `${x}%`, top: `${y}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', damping: 20, stiffness: 60 }}
        >
          <CourierMarker />
        </m.div>
      </LazyMotion>
    </MotionConfig>
  );
}
