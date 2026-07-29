// ImagePreloader.js
import React, { useEffect } from 'react';

const ImagePreloader = ({ imageUrls }) => {
  useEffect(() => {
    imageUrls.forEach(url => {
      const img = new Image();
      img.src = url;
    });
  }, [imageUrls]);

  return null; // Preloader component doesn't render anything
};

export default ImagePreloader;
