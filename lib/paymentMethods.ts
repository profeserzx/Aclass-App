// Cash and card aren't accepted by the school — only these three are valid.
// Kept in a plain (non "use server") module because "use server" files may
// only export async functions — a const array export breaks that rule.
export const PAYMENT_METHODS = ["mpesa", "bank", "cheque"] as const;
