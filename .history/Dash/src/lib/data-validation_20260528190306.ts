/**
 * Data validation utility to prevent raw/unformatted data from being displayed.
 * Ensures data meets expected patterns and formatting standards.
 */

export type DataValidationError = {
  field: string;
  reason: string;
};

/**
 * Check if text contains raw HTML/XML that shouldn't be displayed
 */
export function isRawMarkup(text: string | null | undefined): boolean {
  if (!text) return false;
  const s = text.trim();
  // Check for HTML tags, XML, or unescaped angle brackets
  return /<[^>]+>/.test(s) && !s.startsWith('<img') && !s.startsWith('<div');
}

/**
 * Check if text looks like it contains raw database/JSON output
 */
export function isRawJson(text: string | null | undefined): boolean {
  if (!text) return false;
  const s = text.trim();
  try {
    // Try to parse as JSON
    const parsed = JSON.parse(s);
    // If it parses successfully and it's an object, it's raw JSON
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    // Not valid JSON
    return false;
  }
}

/**
 * Check if text appears to be a raw database value (no natural language structure)
 */
export function looksLikeRawData(text: string | null | undefined): boolean {
  if (!text) return false;
  const s = text.trim();
  
  // Too short to be meaningful content
  if (s.length < 3) return true;
  
  // Contains only special characters, no words
  if (!/[a-zA-Z]{3,}/.test(s)) return true;
  
  // Looks like a database ID or technical identifier
  if (/^[a-f0-9\-]{20,}$/.test(s) || /^user_[a-z0-9]+$/.test(s)) return true;
  
  return false;
}

/**
 * Check if a date string is properly formatted
 */
export function isProperlyFormattedDate(date: string | null | undefined): boolean {
  if (!date) return false;
  const d = new Date(date);
  return !isNaN(d.getTime());
}

/**
 * Check if a number is valid (not NaN, Infinity, etc.)
 */
export function isValidNumber(num: unknown): boolean {
  if (typeof num !== 'number') return false;
  return !isNaN(num) && isFinite(num);
}

/**
 * Validate job title - should be meaningful text
 */
export function validateJobTitle(title: string | null | undefined): { valid: boolean; error?: string } {
  if (!title) return { valid: false, error: 'Job title is missing' };
  const t = title.trim();
  if (t.length < 3) return { valid: false, error: 'Job title is too short' };
  if (looksLikeRawData(t)) return { valid: false, error: 'Job title appears to be raw data' };
  if (isRawMarkup(t)) return { valid: false, error: 'Job title contains unprocessed markup' };
  return { valid: true };
}

/**
 * Validate company name - should be meaningful text
 */
export function validateCompanyName(company: string | null | undefined): { valid: boolean; error?: string } {
  if (!company) return { valid: false, error: 'Company name is missing' };
  const c = company.trim();
  if (c.length < 2) return { valid: false, error: 'Company name is too short' };
  if (looksLikeRawData(c)) return { valid: false, error: 'Company name appears to be raw data' };
  return { valid: true };
}

/**
 * Validate job description - should have meaningful content
 */
export function validateJobDescription(description: string | null | undefined): { valid: boolean; error?: string } {
  if (!description) return { valid: false, error: 'Description is missing' };
  const d = description.trim();
  if (d.length < 20) return { valid: false, error: 'Description is too short to be meaningful' };
  if (looksLikeRawData(d)) return { valid: false, error: 'Description appears to be raw data' };
  if (isRawJson(d)) return { valid: false, error: 'Description contains raw JSON' };
  if (isRawMarkup(d) && !/<img|<a|<div|<p|<span|<strong|<em|<li|<ul|<h[1-6]/.test(d)) {
    return { valid: false, error: 'Description contains unprocessed markup' };
  }
  return { valid: true };
}

/**
 * Validate location - should be a place name
 */
export function validateLocation(location: string | null | undefined): { valid: boolean; error?: string } {
  if (!location) return { valid: true }; // Location is optional
  const l = location.trim();
  if (l.length < 2) return { valid: false, error: 'Location is too short' };
  if (looksLikeRawData(l)) return { valid: false, error: 'Location appears to be raw data' };
  return { valid: true };
}

/**
 * Validate match score - should be a number between 0-100
 */
export function validateMatchScore(score: unknown): { valid: boolean; error?: string } {
  if (score === null || score === undefined) return { valid: true }; // Optional
  if (!isValidNumber(score as number)) return { valid: false, error: 'Match score must be a valid number' };
  const s = score as number;
  if (s < 0 || s > 100) return { valid: false, error: 'Match score must be between 0 and 100' };
  return { valid: true };
}

/**
 * Validate salary text - should be a readable string
 */
export function validateSalaryText(salary: string | null | undefined): { valid: boolean; error?: string } {
  if (!salary) return { valid: true }; // Optional
  const s = salary.trim();
  if (s.length < 2) return { valid: true }; // Empty is OK
  if (looksLikeRawData(s)) return { valid: false, error: 'Salary appears to be raw data' };
  return { valid: true };
}

/**
 * Validate a complete job object
 */
export function validateJobData(job: {
  title?: string | null;
  company?: string | null;
  description?: string | null;
  role_description?: string | null;
  location?: string | null;
  match_score?: unknown;
  salary_text?: string | null;
  job_type?: string | null;
} | null | undefined): { valid: boolean; errors: DataValidationError[] } {
  const errors: DataValidationError[] = [];

  if (!job) {
    return { valid: false, errors: [{ field: 'job', reason: 'Job data is missing' }] };
  }

  // Required fields
  const titleCheck = validateJobTitle(job.title);
  if (!titleCheck.valid) errors.push({ field: 'title', reason: titleCheck.error! });

  const companyCheck = validateCompanyName(job.company);
  if (!companyCheck.valid) errors.push({ field: 'company', reason: companyCheck.error! });

  // Description or role_description should exist
  const hasDescription = job.description?.trim() || job.role_description?.trim();
  if (!hasDescription) {
    errors.push({ field: 'description', reason: 'No job description available' });
  } else {
    const descToCheck = job.description || job.role_description;
    const descCheck = validateJobDescription(descToCheck);
    if (!descCheck.valid) errors.push({ field: 'description', reason: descCheck.error! });
  }

  // Optional fields with validation if present
  const locationCheck = validateLocation(job.location);
  if (!locationCheck.valid) errors.push({ field: 'location', reason: locationCheck.error! });

  const scoreCheck = validateMatchScore(job.match_score);
  if (!scoreCheck.valid) errors.push({ field: 'match_score', reason: scoreCheck.error! });

  const salaryCheck = validateSalaryText(job.salary_text);
  if (!salaryCheck.valid) errors.push({ field: 'salary_text', reason: salaryCheck.error! });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate application data
 */
export function validateApplicationData(app: {
  job_title?: string | null;
  company?: string | null;
  status?: string | null;
  created_at?: string | null;
  jobs?: { [key: string]: unknown } | null;
} | null | undefined): { valid: boolean; errors: DataValidationError[] } {
  const errors: DataValidationError[] = [];

  if (!app) {
    return { valid: false, errors: [{ field: 'application', reason: 'Application data is missing' }] };
  }

  // Validate job title
  const titleCheck = validateJobTitle(app.job_title);
  if (!titleCheck.valid) errors.push({ field: 'job_title', reason: titleCheck.error! });

  // Validate company
  const companyCheck = validateCompanyName(app.company);
  if (!companyCheck.valid) errors.push({ field: 'company', reason: companyCheck.error! });

  // Validate created_at is a proper date
  if (app.created_at && !isProperlyFormattedDate(app.created_at)) {
    errors.push({ field: 'created_at', reason: 'Created date is not properly formatted' });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a string should be displayed (not raw/unformatted)
 */
export function isDisplayable(text: string | null | undefined, minLength: number = 3): boolean {
  if (!text) return false;
  const s = text.trim();
  if (s.length < minLength) return false;
  if (isRawMarkup(s)) return false;
  if (isRawJson(s)) return false;
  if (looksLikeRawData(s)) return false;
  return true;
}
