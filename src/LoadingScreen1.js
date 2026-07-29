import React from 'react';

const LoadingScreen1 = ({ progress }) => (
  <div style={{
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: '#f0f0f0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'column',
    zIndex: 9999 // Ensure it's on top of everything
  }}>
    <h2>Loading...</h2>
    <div style={{ width: '50%', height: '20px', background: '#ccc', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ width: `${progress}%`, height: '100%', background: '#3498db', transition: 'width 0.3s ease-out' }}></div>
    </div>
    <p>{progress}%</p>
  </div>
);

export default LoadingScreen1;
