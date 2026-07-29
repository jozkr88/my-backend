// Modal.js
import { useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';

const Modal = ({ isOpen, onClose }) => {
  const { size } = useThree();

  if (!isOpen) return null;

  return (
    <Html center style={{ pointerEvents: 'auto' }}>
      <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 999 }}>
        <div className="modal" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000 }}>
          <span className="close" onClick={onClose} style={{ position: 'absolute', top: 10, right: 10, cursor: 'pointer', zIndex: 1001 }}>&times;</span>
          <div className="modal-content" style={{ padding: 20 }}>
            <p>This is the modal content.</p>
          </div>
        </div>
      </div>
    </Html>
  );
};

const ModalButton = ({ onClick }) => (
  <Html center style={{ pointerEvents: 'auto' }}>
    <div className="modal-button" style={{ position: 'fixed', top: 20, left: 20, zIndex: 999, cursor: 'pointer' }} onClick={onClick}>Open Modal</div>
  </Html>
);

export { Modal, ModalButton };
