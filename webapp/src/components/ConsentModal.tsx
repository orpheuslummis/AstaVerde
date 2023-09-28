import React, { useState } from "react";
import Modal from "@mui/material/Modal";

interface ConsentModalProps {
  onClose: () => void;
}

const ConsentModal: React.FC<ConsentModalProps> = ({ onClose }) => {
  const [open, setOpen] = useState(true); // initially set to true to show on first load

  const handleClose = () => {
    setOpen(false);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <div>
        <h2>Consent Required</h2>
        <p>Please read and accept our terms, instructions, and disclaimer.</p>
        <button onClick={handleClose}>Accept</button>
      </div>
    </Modal>
  );
};

export default ConsentModal;
