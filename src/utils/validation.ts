export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const validateGstin = (gstin: string): boolean => {
  return GSTIN_REGEX.test(gstin);
};

export const calculateConfidence = (invoiceData: any): number => {
  let score = 0;
  let checks = 0;

  // Check 1: GSTIN format
  if (invoiceData.gstin) {
    checks++;
    if (validateGstin(invoiceData.gstin)) score++;
  }

  // Check 2: Total Amount exists
  if (invoiceData.totalAmount) {
    checks++;
    score++;
  }

  // Check 3: Items match total (approx)
  if (invoiceData.items && invoiceData.items.length > 0 && invoiceData.totalAmount) {
    checks++;
    const sum = invoiceData.items.reduce((acc: number, item: any) => acc + (item.amount || 0), 0);
    const diff = Math.abs(sum - invoiceData.totalAmount);
    if (diff < 1.0) score++; // Allow small rounding error
  }

  return checks === 0 ? 0 : (score / checks) * 100;
};
