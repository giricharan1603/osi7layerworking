/**
 * Implements Character Count, Character Stuffing, Bit Stuffing, and CRC-16 checks
 */

// Helper to compute a simple 16-bit CRC checksum string
export function computeCRC(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      if (crc & 1) crc = (crc >> 1) ^ 0xA001;
      else crc >>= 1;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export function applyFraming(data, type) {
  const crc = computeCRC(data);
  const payloadWithCrc = `${data}|${crc}`; // Append CRC to trailer

  switch(type) {
    case 'charCount': {
      // Header defines the total frame character length including the count digit itself
      const totalLen = payloadWithCrc.length + 2; 
      return `${totalLen.toString().padStart(2, '0')}${payloadWithCrc}`;
    }
    case 'charStuff': {
      // Escape any accidental internal DLE flags by doubling them
      const escaped = payloadWithCrc.replace(/DLE/g, "DLE DLE");
      return `DLE STX ${escaped} DLE ETX`;
    }
    case 'bitStuff': {
      // Dummy bit stuffing visual pattern wrapper
      return `01111110 [${payloadWithCrc}] 01111110`;
    }
    default:
      return payloadWithCrc;
  }
}

export function stripFraming(frame, type) {
  let payloadWithCrc = "";

  if (type === 'charCount') {
    payloadWithCrc = frame.substring(2);
  } else if (type === 'charStuff') {
    payloadWithCrc = frame.replace("DLE STX ", "").replace(" DLE ETX", "").replace(/DLE DLE/g, "DLE");
  } else if (type === 'bitStuff') {
    payloadWithCrc = frame.replace("01111110 [", "").replace("] 01111110", "");
  }

  const parts = payloadWithCrc.split('|');
  const payload = parts[0];
  const receivedCrc = parts[1];
  const expectedCrc = computeCRC(payload);

  return {
    payload,
    isValid: receivedCrc === expectedCrc
  };
}
