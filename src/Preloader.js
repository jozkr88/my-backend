import React, { useEffect, useState } from 'react';

const Preloader = ({ files }) => {
  const [imagesLoaded, setImagesLoaded] = useState(false);

  useEffect(() => {
    const loadImage = (imagePath) => {
      return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = resolve;
        image.onerror = reject;
        image.src = imagePath;
      });
    };

    const preloadImages = async () => {
      try {
        await Promise.all(files.map(file => loadImage(file)));
        setImagesLoaded(true);
      } catch (error) {
        console.error('Error preloading images:', error);
      }
    };

    preloadImages();
  }, [files]);

  return imagesLoaded ? null : <div>Voice-powered, memory-driven reasoning.</div>;
};

export default Preloader;
