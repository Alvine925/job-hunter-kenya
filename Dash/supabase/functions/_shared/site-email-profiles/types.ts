export type SiteEmailProfile = {
  id: string;
  name: string;
  domains: string[];
  defaultApplicationMethod: "email";
  /** Re-scrape the job URL for full listing (Terms and Conditions, apply instructions). */
  alwaysScrapeFullPage: boolean;
  emailExtractionNote: string;
  subjectRule: string;
  bodyRules: string;
  emailDraftTemplate: string;
};
