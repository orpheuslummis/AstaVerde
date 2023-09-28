import React, { useState } from "react";
import Modal from "@mui/material/Modal";

interface CookieModalProps {
  onClose: () => void;
}

const CookieModal: React.FC<CookieModalProps> = ({ onClose }) => {
  const [open, setOpen] = useState(true); // initially set to true to show on first load

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <div>
        <h2>Cookie Policy</h2>
        <p>We use cookies to improve your experience.</p>
        <button onClick={handleClose}>Accept</button>
      </div>
    </Modal>
  );
};

export default CookieModal;
