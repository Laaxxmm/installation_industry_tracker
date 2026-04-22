/**
 * Organisation-level constants sourced from env with sensible dev defaults.
 * Used by GST math and PDF templates.
 */

export function sabStateCode(): string {
  return process.env.SAB_STATE_CODE ?? "29"; // Karnataka default
}

export function sabGstin(): string {
  return process.env.SAB_GSTIN ?? "29AAACS0000A1Z5";
}

export function sabAddress(): string {
  return (
    process.env.SAB_ADDRESS ??
    "SAB India Pvt Ltd\nHead Office, Bengaluru, Karnataka"
  );
}

export function sabBankDetails(): string {
  return (
    process.env.SAB_BANK_DETAILS ??
    "Bank: HDFC Bank\nA/C: 00000000000000\nIFSC: HDFC0000000\nBranch: Bengaluru"
  );
}

export function sabLogoUrl(): string | undefined {
  return process.env.SAB_LOGO_URL || undefined;
}

export function sabCompanyName(): string {
  return process.env.SAB_COMPANY_NAME ?? "SAB India Pvt Ltd";
}
