export const serializeBigInt = (obj: unknown): unknown => {
    if (typeof obj === 'bigint') {
      return obj.toString();
    }
    if (Array.isArray(obj)) {
      return obj.map(serializeBigInt);
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, serializeBigInt(value)])
      );
    }
    return obj;
  };
  
  export const deserializeBigInt = (obj: unknown): unknown => {
    if (typeof obj === 'string' && /^-?\d+$/.test(obj)) {
      return BigInt(obj);
    }
    if (Array.isArray(obj)) {
      return obj.map(deserializeBigInt);
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, deserializeBigInt(value)])
      );
    }
    return obj;
  };