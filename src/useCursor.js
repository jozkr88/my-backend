import { useState } from 'react';
import { useFrame } from '@react-three/fiber';

const useCursor = (hovered, id) => {
  const [cursor, setCursor] = useState('auto');

  useFrame(() => {
    if (hovered && id === 'how-it-works') {
      setCursor('crosshair');
    } else {
      setCursor('auto');
    }
  });

  return cursor;
};

export default useCursor;