export type VaultFieldType = 'text' | 'number' | 'date' | 'password' | 'textarea' | 'select';
export type VaultField = { key: string; label: string; type?: VaultFieldType; hint: string; sensitive?: boolean; options?: string[]; full?: boolean; showIf?: { key: string; equals: string } };
export type VaultSection = { id: string; label: string; caption: string; titleKey: string; subtitleKey?: string; fields: VaultField[] };
export type VaultRecord = { id: string } & Record<string, string>;
export type VaultData = Record<string, VaultRecord[]>;

export const VAULT_SECTIONS: VaultSection[] = [
  {
    id: 'documents', label: 'Important documents', caption: 'Identity & government records',
    titleKey: 'nameOnDocument', subtitleKey: 'docType',
    fields: [
      { key: 'docType', label: 'Document', type: 'select', hint: 'Which document this is. Pick “Other” to name your own.', options: ['PAN card', 'Aadhaar card', 'Passport', 'Driving licence', 'Voter / Election ID', 'Ration card', 'Birth certificate', 'Marriage certificate', 'Will', 'Property papers', 'Mediclaim / Health card', 'Education certificate', 'Vehicle RC', 'Other'] },
      { key: 'customType', label: 'Name the document', type: 'text', hint: 'Type the document name when you choose “Other”.', showIf: { key: 'docType', equals: 'Other' } },
      { key: 'nameOnDocument', label: 'Name on document', type: 'text', hint: 'The name exactly as printed on the document.' },
      { key: 'number', label: 'Document number', type: 'password', hint: 'The identifying number on the document.', sensitive: true },
      { key: 'issueDate', label: 'Issued on', type: 'date', hint: 'Date the document was issued.' },
      { key: 'expiryDate', label: 'Valid until', type: 'date', hint: 'Expiry date, if the document has one.' },
      { key: 'issuingAuthority', label: 'Issuing authority', type: 'text', hint: 'Who issued it, e.g. RTO, Passport Seva, UIDAI.' },
      { key: 'locationPhysical', label: 'Location — physical', type: 'text', hint: 'Where the original is kept, e.g. home locker, bank locker.' },
      { key: 'locationVirtual', label: 'Location — virtual', type: 'text', hint: 'Where a soft copy / scan is stored, e.g. DigiLocker, Google Drive.' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Anything else worth remembering.', full: true },
    ],
  },
  {
    id: 'insurance', label: 'Insurance & policies', caption: 'Life, health & other cover',
    titleKey: 'policyName', subtitleKey: 'provider',
    fields: [
      { key: 'policyName', label: 'Policy name', type: 'text', hint: 'A short label for this policy.' },
      { key: 'provider', label: 'Provider / insurer', type: 'text', hint: 'The company that issued the policy, e.g. LIC, HDFC Ergo.' },
      { key: 'policyType', label: 'Type', type: 'select', hint: 'The kind of cover this policy provides.', options: ['Life', 'Term', 'Health', 'ULIP', 'Motor', 'Travel', 'Home', 'Other'] },
      { key: 'policyNumber', label: 'Policy number', type: 'password', hint: 'The policy / certificate number.', sensitive: true },
      { key: 'holderName', label: 'Policy holder', type: 'text', hint: 'Who the policy is held by.' },
      { key: 'nominee', label: 'Nominee', type: 'text', hint: 'Who is nominated for this policy.' },
      { key: 'sumAssured', label: 'Sum assured (₹)', type: 'number', hint: 'The cover / sum assured amount.' },
      { key: 'premium', label: 'Premium (₹)', type: 'number', hint: 'The premium amount per payment.' },
      { key: 'premiumFrequency', label: 'Premium frequency', type: 'select', hint: 'How often the premium is paid.', options: ['Monthly', 'Quarterly', 'Half-yearly', 'Yearly', 'Single'] },
      { key: 'startDate', label: 'Start date', type: 'date', hint: 'When the policy began.' },
      { key: 'maturityDate', label: 'Maturity date', type: 'date', hint: 'When the policy matures, if applicable.' },
      { key: 'advisorName', label: 'Advisor name', type: 'text', hint: 'Your agent or advisor for this policy.' },
      { key: 'advisorPhone', label: 'Advisor phone', type: 'text', hint: 'Contact number of the advisor.' },
      { key: 'advisorEmail', label: 'Advisor email', type: 'text', hint: 'Email of the advisor.' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Servicing branch or other notes.', full: true },
    ],
  },
  {
    id: 'banks', label: 'Bank accounts', caption: 'Accounts & net-banking',
    titleKey: 'bankName', subtitleKey: 'accountType',
    fields: [
      { key: 'bankName', label: 'Bank', type: 'text', hint: 'Name of the bank.' },
      { key: 'accountType', label: 'Account type', type: 'select', hint: 'The kind of account.', options: ['Savings', 'Current', 'Salary', 'NRE', 'NRO', 'Other'] },
      { key: 'accountNumber', label: 'Account number', type: 'password', hint: 'The bank account number.', sensitive: true },
      { key: 'ifsc', label: 'IFSC', type: 'text', hint: 'The branch IFSC code.' },
      { key: 'branch', label: 'Branch', type: 'text', hint: 'Home branch name or city.' },
      { key: 'holderName', label: 'Account holder', type: 'text', hint: 'Primary account holder name.' },
      { key: 'nominee', label: 'Nominee', type: 'text', hint: 'Who is nominated on this account.' },
      { key: 'customerId', label: 'Customer ID', type: 'password', hint: 'Customer / CIF ID used for login.', sensitive: true },
      { key: 'netbankingUserId', label: 'Net-banking user ID', type: 'password', hint: 'Username used for internet banking.', sensitive: true },
      { key: 'regdMobile', label: 'Registered mobile', type: 'text', hint: 'Mobile number linked to this account.' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Debit card, cheque book, or notes.', full: true },
    ],
  },
  {
    id: 'passwords', label: 'Online passwords', caption: 'Website & app logins',
    titleKey: 'service', subtitleKey: 'username',
    fields: [
      { key: 'service', label: 'Service / website', type: 'text', hint: 'The website or app this login is for.' },
      { key: 'url', label: 'URL', type: 'text', hint: 'The login page address.' },
      { key: 'username', label: 'Username / email', type: 'text', hint: 'The username or email you sign in with.' },
      { key: 'password', label: 'Password', type: 'password', hint: 'The password for this login.', sensitive: true },
      { key: 'twoFactor', label: 'Two-factor / recovery', type: 'textarea', hint: 'Backup codes, authenticator notes, or recovery info.', sensitive: true, full: true },
      { key: 'awarePerson', label: 'Person who is aware', type: 'text', hint: 'Someone you trust who knows about this login, for emergencies.' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Security questions or other notes.', full: true },
    ],
  },
  {
    id: 'cards', label: 'Debit & credit cards', caption: 'Card details',
    titleKey: 'bank', subtitleKey: 'cardType',
    fields: [
      { key: 'cardType', label: 'Card type', type: 'select', hint: 'Debit, credit, or prepaid.', options: ['Debit', 'Credit', 'Prepaid'] },
      { key: 'network', label: 'Network', type: 'select', hint: 'The card network.', options: ['Visa', 'Mastercard', 'RuPay', 'Amex', 'Diners', 'Other'] },
      { key: 'bank', label: 'Issuing bank', type: 'text', hint: 'The bank that issued the card.' },
      { key: 'nameOnCard', label: 'Name on card', type: 'text', hint: 'The cardholder name printed on the card.' },
      { key: 'cardNumber', label: 'Card number', type: 'password', hint: 'The 16-digit card number.', sensitive: true },
      { key: 'expiry', label: 'Expiry (MM/YY)', type: 'text', hint: 'The card expiry date.' },
      { key: 'cvv', label: 'CVV', type: 'password', hint: 'The 3-digit security code.', sensitive: true },
      { key: 'pin', label: 'PIN', type: 'password', hint: 'The card PIN.', sensitive: true },
      { key: 'creditLimit', label: 'Credit limit (₹)', type: 'number', hint: 'Credit limit, for credit cards.' },
      { key: 'billingDate', label: 'Billing date', type: 'text', hint: 'Statement / billing day of month.' },
      { key: 'regdMobile', label: 'Registered mobile', type: 'text', hint: 'Mobile number registered on this card.' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Reward programme, due date, or notes.', full: true },
    ],
  },
  {
    id: 'property', label: 'Property details', caption: 'Land & buildings',
    titleKey: 'propertyName', subtitleKey: 'propertyType',
    fields: [
      { key: 'propertyName', label: 'Property name', type: 'text', hint: 'A short label, e.g. “Flat · Pune”.' },
      { key: 'propertyType', label: 'Type', type: 'select', hint: 'The kind of property.', options: ['Flat / Apartment', 'Independent house', 'Plot / Land', 'Commercial', 'Agricultural', 'Other'] },
      { key: 'area', label: 'Area', type: 'text', hint: 'Size, e.g. 1200 sq ft or 2 acres.' },
      { key: 'address', label: 'Address', type: 'textarea', hint: 'Full address of the property.', full: true },
      { key: 'owners', label: 'Owner(s)', type: 'text', hint: 'Names of all owners.' },
      { key: 'registrationNumber', label: 'Registration number', type: 'password', hint: 'Registration / survey number.', sensitive: true },
      { key: 'nominee', label: 'Nominee', type: 'text', hint: 'Who is nominated for this property.' },
      { key: 'purchaseDate', label: 'Purchase date', type: 'date', hint: 'When the property was acquired.' },
      { key: 'currentValue', label: 'Current value (₹)', type: 'number', hint: 'Approximate market value today.' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Loan, tenant, or document-locker notes.', full: true },
    ],
  },
  {
    id: 'liabilities', label: 'Liabilities', caption: 'Loans & borrowings',
    titleKey: 'lender', subtitleKey: 'liabilityType',
    fields: [
      { key: 'lender', label: 'Bank / lender', type: 'text', hint: 'Who the money is owed to.' },
      { key: 'liabilityType', label: 'Type of liability', type: 'select', hint: 'The kind of borrowing.', options: ['Home loan', 'Personal loan', 'Car loan', 'Education loan', 'Credit card', 'Gold loan', 'Business loan', 'Other'] },
      { key: 'amount', label: 'Outstanding amount (₹)', type: 'number', hint: 'Balance still to repay.' },
      { key: 'interestRate', label: 'Interest rate (%)', type: 'number', hint: 'Annual interest rate.' },
      { key: 'emi', label: 'EMI (₹)', type: 'number', hint: 'Monthly instalment amount.' },
      { key: 'tenure', label: 'Tenure / period', type: 'text', hint: 'Total period, e.g. 20 years or 60 months.' },
      { key: 'startDate', label: 'Start date', type: 'date', hint: 'When the loan was taken.' },
      { key: 'terms', label: 'Terms', type: 'textarea', hint: 'Terms, co-borrowers, or conditions.', full: true },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Account number, foreclosure notes, etc.', full: true },
    ],
  },
  {
    id: 'investments', label: 'Investments', caption: 'Demat, MF & other accounts',
    titleKey: 'platform', subtitleKey: 'accountType',
    fields: [
      { key: 'accountType', label: 'Account type', type: 'text', hint: 'e.g. Demat, Mutual fund, PPF, NPS, FD.' },
      { key: 'platform', label: 'Platform / broker', type: 'text', hint: 'Where the account is held, e.g. Zerodha, Groww.' },
      { key: 'accountHolderName', label: 'Account holder name', type: 'text', hint: 'Whose name the account is in.' },
      { key: 'linkedBank', label: 'Linked bank', type: 'text', hint: 'Bank account linked for funds.' },
      { key: 'regdMobile', label: 'Registered mobile', type: 'text', hint: 'Mobile number registered on the account.' },
      { key: 'email', label: 'Registered email', type: 'text', hint: 'Email registered on the account.' },
      { key: 'clientId', label: 'Client / folio ID', type: 'password', hint: 'Client ID, DP ID, or folio number.', sensitive: true },
      { key: 'value', label: 'Current value (₹)', type: 'number', hint: 'Approximate value held, if you want to note it.' },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Nominee, mandate, or other notes.', full: true },
    ],
  },
  {
    id: 'personal', label: 'Basic details', caption: 'Personal & emergency info',
    titleKey: 'fullName', subtitleKey: 'bloodGroup',
    fields: [
      { key: 'fullName', label: 'Full name', type: 'text', hint: 'Full legal name.' },
      { key: 'dob', label: 'Date of birth', type: 'date', hint: 'Date of birth.' },
      { key: 'bloodGroup', label: 'Blood group', type: 'select', hint: 'Blood group, useful in emergencies.', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown'] },
      { key: 'mobile', label: 'Mobile', type: 'text', hint: 'Primary mobile number.' },
      { key: 'email', label: 'Email', type: 'text', hint: 'Primary email address.' },
      { key: 'emergencyContactName', label: 'Emergency contact', type: 'text', hint: 'Who to call in an emergency.' },
      { key: 'emergencyContactPhone', label: 'Emergency phone', type: 'text', hint: 'Phone number of the emergency contact.' },
      { key: 'familyMembers', label: 'Family members', type: 'textarea', hint: 'Names and relationships of your family members.', full: true },
      { key: 'dependents', label: 'Dependents', type: 'textarea', hint: 'People who depend on you financially.', full: true },
      { key: 'address', label: 'Address', type: 'textarea', hint: 'Current residential address.', full: true },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'Anything else worth keeping handy.', full: true },
    ],
  },
  {
    id: 'contacts', label: 'Important contacts', caption: 'People to reach when needed',
    titleKey: 'name', subtitleKey: 'contactType',
    fields: [
      { key: 'contactType', label: 'Who', type: 'select', hint: 'The person or role this contact is.', options: ['Self', 'Spouse', 'Father', 'Mother', 'Son', 'Daughter', 'Brother', 'Sister', 'Family doctor', 'Lawyer', 'Chartered accountant', 'Office HR', 'Financial advisor', 'Friend', 'Other'] },
      { key: 'name', label: 'Name of contact', type: 'text', hint: 'Full name of the person.' },
      { key: 'mobile', label: 'Mobile', type: 'text', hint: 'Primary phone number.' },
      { key: 'email', label: 'Email', type: 'text', hint: 'Email address.' },
      { key: 'address', label: 'Address', type: 'textarea', hint: 'Address of the contact.', full: true },
      { key: 'remarks', label: 'Remarks', type: 'textarea', hint: 'How they help, availability, or other notes.', full: true },
    ],
  },
];

const SECTION_IDS = VAULT_SECTIONS.map((section) => section.id);
const KEY = 'goodmeasure-vault-v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function normalizeRecord(section: VaultSection, value: unknown, index: number): VaultRecord {
  const source = isRecord(value) ? value : {};
  const id = typeof source.id === 'string' && source.id ? source.id : `${section.id}-${index}-${Math.random().toString(36).slice(2, 7)}`;
  const record: VaultRecord = { id };
  for (const field of section.fields) {
    const raw = source[field.key];
    record[field.key] = typeof raw === 'string' ? raw : typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : '';
  }
  return record;
}

export function normalizeVault(value: unknown): VaultData {
  const source = isRecord(value) ? value : {};
  const result: VaultData = {};
  for (const section of VAULT_SECTIONS) {
    const rows = Array.isArray(source[section.id]) ? (source[section.id] as unknown[]) : [];
    result[section.id] = rows.map((row, index) => normalizeRecord(section, row, index));
  }
  return result;
}

export function blankVault(): VaultData {
  const result: VaultData = {};
  for (const id of SECTION_IDS) result[id] = [];
  return result;
}

export function loadVault(): VaultData {
  const raw = localStorage.getItem(KEY);
  if (!raw) return blankVault();
  try {
    return normalizeVault(JSON.parse(raw));
  } catch {
    return blankVault();
  }
}

export function saveVault(vault: VaultData) {
  localStorage.setItem(KEY, JSON.stringify(vault));
}

export function vaultCount(vault: VaultData): number {
  return SECTION_IDS.reduce((sum, id) => sum + (vault[id]?.length ?? 0), 0);
}
