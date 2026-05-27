/** Industry presets — apply together to roles, counties, and companies. */
export type IndustryPresetId = "NGO" | "Finance" | "Tech" | "Government";

export type IndustryPreset = {
  id: IndustryPresetId;
  label: string;
  description: string;
  roles: string[];
  counties: string[];
  companies: string[];
  sectors: CompanySectorId[];
  jobTypes?: string[];
};

export type CompanySectorId =
  | "NGO"
  | "UN"
  | "Banking"
  | "Telco"
  | "Tech"
  | "Education"
  | "Health"
  | "Manufacturing"
  | "Energy"
  | "Agriculture"
  | "Logistics"
  | "Media"
  | "Investment"
  | "Retail"
  | "PublicSector"
  | "scraped";

export const INDUSTRY_PRESETS: IndustryPreset[] = [
  {
    id: "NGO",
    label: "NGO & Development",
    description: "Programs, M&E, grants, and field operations",
    roles: [
      "Program Officer",
      "Monitoring & Evaluation Officer",
      "Project Coordinator",
      "Grants Officer",
      "Research Officer",
      "Field Coordinator",
      "Communications Officer",
      "Partnerships Manager",
    ],
    counties: ["Nairobi", "Mombasa", "Kisumu", "Garissa", "Turkana", "Mandera", "Nakuru"],
    companies: [
      "UN Agencies",
      "World Bank",
      "USAID",
      "GIZ",
      "Oxfam",
      "Save the Children",
      "World Vision",
      "CARE International",
      "Plan International",
      "Amref Health Africa",
      "Red Cross",
    ],
    sectors: ["NGO", "UN"],
    jobTypes: ["Full-time", "Contract"],
  },
  {
    id: "Finance",
    label: "Finance & Banking",
    description: "Banking, insurance, fintech, and corporate finance",
    roles: [
      "Accountant",
      "Finance Officer",
      "Financial Analyst",
      "Credit Analyst",
      "Risk Officer",
      "Compliance Officer",
      "Internal Auditor",
      "Relationship Manager",
      "Business Analyst",
    ],
    counties: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Kiambu", "Uasin Gishu"],
    companies: [
      "Equity Bank",
      "KCB",
      "Co-operative Bank",
      "Standard Chartered",
      "NCBA",
      "Britam",
      "Jubilee Insurance",
      "Cellulant",
      "M-Kopa",
    ],
    sectors: ["Banking"],
    jobTypes: ["Full-time"],
  },
  {
    id: "Tech",
    label: "Technology",
    description: "Software, data, product, and IT operations",
    roles: [
      "Software Engineer",
      "Data Analyst",
      "Data Scientist",
      "DevOps Engineer",
      "Product Manager",
      "UX Designer",
      "IT Support Specialist",
      "Cybersecurity Analyst",
      "Business Intelligence Analyst",
    ],
    counties: ["Nairobi", "Kiambu", "Mombasa", "Kajiado"],
    companies: [
      "Safaricom",
      "Andela",
      "Cellulant",
      "Twiga Foods",
      "BasiGo",
      "M-Kopa",
      "Kenya Power",
      "Kenya Airways",
    ],
    sectors: ["Telco"],
    jobTypes: ["Full-time", "Remote", "Contract"],
  },
  {
    id: "Government",
    label: "Government & Public Sector",
    description: "Public administration, policy, and parastatals",
    roles: [
      "Administrative Officer",
      "Policy Analyst",
      "Procurement Officer",
      "Human Resources Officer",
      "Communications Officer",
      "Monitoring & Evaluation Officer",
      "Planning Officer",
      "Legal Officer",
    ],
    counties: ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Nyeri", "Meru", "Machakos"],
    companies: [
      "Kenya Power",
      "Kenya Airways",
      "Kenya Revenue Authority",
      "Kenya Ports Authority",
      "Kenya Railways",
      "National Treasury",
      "County Government",
    ],
    sectors: ["Education", "Health"],
    jobTypes: ["Full-time", "Contract"],
  },
];

export const COUNTY_SUGGESTIONS = [
  "Nairobi",
  "Mombasa",
  "Kisumu",
  "Nakuru",
  "Kiambu",
  "Machakos",
  "Kajiado",
  "Uasin Gishu",
  "Kakamega",
  "Kisii",
  "Meru",
  "Nyeri",
  "Bungoma",
  "Kilifi",
  "Kwale",
  "Mandera",
  "Garissa",
  "Turkana",
  "Laikipia",
  "Bomet",
];

/** Role catalog with synonym aliases for search-as-you-type. */
export const ROLE_CATALOG: { label: string; aliases: string[] }[] = [
  // NGO & Development
  { label: "Monitoring & Evaluation Officer", aliases: ["M&E", "ME", "M&E Officer", "Monitoring and Evaluation", "MEL Officer", "MEL Specialist"] },
  { label: "Program Officer", aliases: ["Programme Officer", "PO", "Programs Officer"] },
  { label: "Project Manager", aliases: ["PM", "Project Lead", "Project Coordinator", "Program Manager"] },
  { label: "Grants Officer", aliases: ["Grant Writer", "Fundraising Officer", "Proposal Writer", "Grants Manager"] },
  { label: "Research Officer", aliases: ["Research Analyst", "Research Associate", "Researcher"] },
  { label: "Field Coordinator", aliases: ["Field Officer", "Community Coordinator", "Field Assistant"] },
  { label: "Partnerships Manager", aliases: ["Partnership Officer", "Donor Relations"] },
  { label: "Country Director", aliases: ["Chief of Party", "Head of Mission"] },
  { label: "Community Development Worker", aliases: ["Social Worker", "Mobilizer"] },
  
  // Finance & Banking
  { label: "Finance Officer", aliases: ["Finance Manager", "Financial Controller", "Director of Finance"] },
  { label: "Accountant", aliases: ["Accounts Officer", "CPA", "Bookkeeper", "Assistant Accountant"] },
  { label: "Financial Analyst", aliases: ["Investment Analyst", "Corporate Finance Analyst"] },
  { label: "Credit Analyst", aliases: ["Credit Officer", "Loan Officer"] },
  { label: "Risk Officer", aliases: ["Risk Manager", "Risk Analyst"] },
  { label: "Compliance Officer", aliases: ["Compliance Manager", "Regulatory Compliance"] },
  { label: "Internal Auditor", aliases: ["Auditor", "Audit Officer", "External Auditor"] },
  { label: "Relationship Manager", aliases: ["RM", "Corporate Banker", "Personal Banker"] },
  { label: "Business Analyst", aliases: ["BA", "Process Analyst"] },
  { label: "Tax Consultant", aliases: ["Tax Analyst", "Tax Specialist"] },
  { label: "Treasury Manager", aliases: ["Treasury Officer", "Cash Manager"] },

  // Tech & IT
  { label: "Software Engineer", aliases: ["Developer", "SWE", "Backend Engineer", "Frontend Engineer", "Fullstack Developer"] },
  { label: "Data Analyst", aliases: ["Analytics", "BI Analyst", "Business Intelligence Analyst"] },
  { label: "Data Scientist", aliases: ["ML Engineer", "Machine Learning", "AI Engineer"] },
  { label: "Product Manager", aliases: ["PM Product", "Product Owner", "Product Specialist"] },
  { label: "DevOps Engineer", aliases: ["SRE", "Platform Engineer", "Cloud Engineer", "Systems Engineer"] },
  { label: "IT Support Specialist", aliases: ["IT Helpdesk", "IT Support Technician", "System Administrator"] },
  { label: "Cybersecurity Analyst", aliases: ["Security Analyst", "Penetration Tester", "Information Security"] },
  { label: "Database Administrator", aliases: ["DBA", "Database Engineer"] },
  { label: "Web Developer", aliases: ["Web Designer", "WordPress Developer"] },
  { label: "Mobile Developer", aliases: ["Android Developer", "iOS Developer", "Flutter Developer"] },
  { label: "Network Engineer", aliases: ["Network Administrator", "Cisco Engineer"] },
  { label: "Scrum Master", aliases: ["Agile Coach", "Project Manager Agile"] },

  // Healthcare
  { label: "Medical Officer", aliases: ["Doctor", "General Practitioner", "GP", "Physician"] },
  { label: "Nurse", aliases: ["Clinical Nurse", "Registered Nurse", "RN", "Midwife"] },
  { label: "Clinical Officer", aliases: ["CO", "Assistant Medical Officer"] },
  { label: "Pharmacist", aliases: ["Pharmaceutical Technologist", "Chemist"] },
  { label: "Lab Technologist", aliases: ["Laboratory Analyst", "Lab Technician"] },
  { label: "Public Health Specialist", aliases: ["Epidemiologist", "Public Health Officer"] },
  { label: "Nutritionist", aliases: ["Dietitian", "Nutrition Officer"] },
  { label: "Physiotherapist", aliases: ["Physical Therapist"] },
  { label: "Dentist", aliases: ["Dental Surgeon", "Dental Hygienist"] },
  { label: "Radiographer", aliases: ["X-Ray Tech", "Imaging Technologist"] },

  // Education
  { label: "Teacher", aliases: ["High School Teacher", "Primary School Teacher", "Tutor", "Educator"] },
  { label: "University Lecturer", aliases: ["Professor", "Assistant Professor", "Academic Tutor"] },
  { label: "Training Coordinator", aliases: ["Trainer", "L&D Specialist", "Learning and Development"] },
  { label: "School Principal", aliases: ["Headteacher", "Dean"] },
  { label: "Curriculum Developer", aliases: ["Instructional Designer"] },

  // Admin, HR & Operations
  { label: "Human Resources Officer", aliases: ["HR Officer", "HR Generalist", "People Operations"] },
  { label: "Human Resources Manager", aliases: ["HR Manager", "Head of HR", "Director of People"] },
  { label: "Administrative Assistant", aliases: ["Admin Officer", "Office Assistant", "Executive Assistant", "Office Administrator"] },
  { label: "Procurement Officer", aliases: ["Purchasing Officer", "Buyer", "Procurement Specialist"] },
  { label: "Logistics Coordinator", aliases: ["Logistics Officer", "Logistics Analyst"] },
  { label: "Customer Service Representative", aliases: ["Customer Support", "Call Center Agent", "Customer Success"] },
  { label: "Supply Chain Specialist", aliases: ["Supply Chain Manager", "Inventory Controller"] },
  { label: "Office Manager", aliases: ["Office Coordinator", "Facilities Manager"] },
  { label: "Receptionist", aliases: ["Front Desk Agent", "Receptionist Secretary"] },
  { label: "Security Manager", aliases: ["Head of Security", "Security Director"] },
  { label: "Operations Manager", aliases: ["Ops Manager", "Operations Lead", "Director of Operations"] },

  // Legal
  { label: "Legal Officer", aliases: ["Lawyer", "Counsel", "Legal Counsel", "Corporate Lawyer"] },
  { label: "Paralegal", aliases: ["Legal Assistant", "Registry Clerk"] },

  // Sales & Marketing
  { label: "Sales Representative", aliases: ["Sales Executive", "Business Development", "BDM", "Sales Agent"] },
  { label: "Digital Marketer", aliases: ["SEO Specialist", "Social Media Manager", "Content Marketer"] },
  { label: "Brand Manager", aliases: ["Brand Executive", "Marketing Coordinator"] },
  { label: "Marketing Manager", aliases: ["Marketing Director", "Head of Marketing"] },
  { label: "PR Officer", aliases: ["Public Relations", "Comms Specialist", "Communications Manager"] },
  { label: "Content Writer", aliases: ["Copywriter", "Editor", "Technical Writer"] },
  { label: "Account Executive", aliases: ["Account Manager", "Client Relations"] },

  // Engineering & Construction
  { label: "Civil Engineer", aliases: ["Structural Engineer", "Site Engineer"] },
  { label: "Electrical Engineer", aliases: ["Power Engineer", "Electronics Engineer"] },
  { label: "Mechanical Engineer", aliases: ["Plant Engineer", "Maintenance Engineer"] },
  { label: "Architect", aliases: ["Landscape Architect", "Urban Planner"] },
  { label: "Quantity Surveyor", aliases: ["QS", "Cost Estimator"] },
  { label: "Construction Manager", aliases: ["Site Supervisor", "Foreman"] },
  { label: "Safety Officer", aliases: ["HSE Officer", "EHS Specialist", "Occupational Health and Safety"] },

  // Agriculture & Agribusiness
  { label: "Agronomist", aliases: ["Agricultural Specialist", "Crop Scientist"] },
  { label: "Farm Manager", aliases: ["Estate Manager", "Agricultural Supervisor"] },
  { label: "Food Scientist", aliases: ["Food Technologist", "Quality Controller Food"] },
  { label: "Veterinarian", aliases: ["Vet Doctor", "Animal Health Officer"] },
  { label: "Agricultural Extension Officer", aliases: ["Extension Agent", "Farmer Trainer"] },

  // Service, Hospitality & Transport
  { label: "Chef", aliases: ["Cook", "Head Chef", "Sous Chef"] },
  { label: "Hotel Manager", aliases: ["Hospitality Manager", "Lodge Manager"] },
  { label: "Driver", aliases: ["Light Vehicle Driver", "Truck Driver", "Chauffeur", "Rider"] },
  { label: "Warehouse Manager", aliases: ["Storekeeper", "Warehouse Supervisor"] },
];

export const COMPANY_SECTORS: Record<
  CompanySectorId,
  { label: string; companies: string[] }
> = {
  NGO: {
    label: "NGO & INGO",
    companies: [
      "Oxfam",
      "Save the Children",
      "World Vision",
      "CARE International",
      "Plan International",
      "Mercy Corps",
      "IRC",
      "ActionAid",
      "Handicap International",
      "Concern Worldwide",
      "Red Cross",
      "Amref Health Africa",
      "Catholic Relief Services",
      "Samaritan's Purse",
      "PATH Kenya",
      "Evidence Action",
      "One Acre Fund",
    ],
  },
  UN: {
    label: "UN & Multilateral",
    companies: [
      "UN Agencies",
      "UNICEF",
      "UNDP",
      "WHO",
      "World Bank",
      "IFC",
      "FAO",
      "WFP",
      "UNHCR",
      "ILO",
      "UNEP",
      "UN-Habitat",
      "IOM",
      "UNESCO",
    ],
  },
  Banking: {
    label: "Banking & Finance",
    companies: [
      "Equity Bank",
      "KCB",
      "Co-operative Bank",
      "Standard Chartered",
      "NCBA",
      "Absa",
      "Stanbic",
      "DTB",
      "Britam",
      "Jubilee Insurance",
      "CIC Insurance",
      "Family Bank",
      "I&M Bank",
      "SBM Bank",
      "National Bank",
      "HF Group",
      "Postbank",
      "Sidian Bank",
      "Faulu Microfinance",
    ],
  },
  Telco: {
    label: "Telco & Communications",
    companies: [
      "Safaricom",
      "Airtel",
      "Telkom",
      "Jamii Telecommunications",
      "Wananchi Group",
      "Liquid Intelligent Technologies",
      "AccessKenya",
    ],
  },
  Tech: {
    label: "Technology & Startups",
    companies: [
      "Andela",
      "Cellulant",
      "Twiga Foods",
      "M-Kopa",
      "BasiGo",
      "Flutterwave",
      "Microsoft",
      "Google",
      "Oracle",
      "Moringa School",
      "Zeraki",
      "Copia Kenya",
      "Sendy",
      "SokoWatch",
      "MarketForce",
      "Asoko Insight",
    ],
  },
  Manufacturing: {
    label: "Manufacturing & Industrial",
    companies: [
      "East African Breweries PLC",
      "Bidco Africa",
      "Bamburi Cement",
      "British American Tobacco",
      "Crown Paints",
      "B.O.C Kenya",
      "Brookside Dairy",
      "Unga Group",
      "Carbacid Investments",
      "Eveready East Africa",
      "Devki Group",
      "Kapa Oil Refineries",
      "Dawa Life Sciences",
      "Keroche Breweries",
      "Haco Industries",
    ],
  },
  Energy: {
    label: "Energy & Utilities",
    companies: [
      "KenGen",
      "Kenya Power",
      "TotalEnergies Kenya",
      "Vivo Energy",
      "Rubis Energy",
      "Geothermal Development Company",
      "Ketraco",
      "Tullow Oil",
      "Davis & Shirtliff",
      "M-Kopa Solar",
      "D.light",
    ],
  },
  Agriculture: {
    label: "Agriculture & Forestry",
    companies: [
      "Kenya Tea Development Agency",
      "Del Monte Kenya",
      "Kakuzi",
      "Sasini",
      "Williamson Tea",
      "Kapchorua Tea",
      "Limuru Tea",
      "Eaagads",
      "Kenyacof",
      "REA Vipingo",
      "KTDA",
    ],
  },
  Logistics: {
    label: "Logistics & Transport",
    companies: [
      "Kenya Airways",
      "Kenya Ports Authority",
      "Kenya Railways",
      "Siginon Group",
      "Bollore Transport & Logistics",
      "DHL Kenya",
      "Mitchell Cotts",
      "Sendy Logistics",
      "Fargo Courier",
      "G4S Kenya",
    ],
  },
  Media: {
    label: "Media & Entertainment",
    companies: [
      "Nation Media Group",
      "Standard Group",
      "Royal Media Services",
      "Mediamax Network",
      "Radio Africa Group",
      "Kenya Broadcasting Corporation",
      "Capital FM",
    ],
  },
  Investment: {
    label: "Investment & Services",
    companies: [
      "Centum Investment Company",
      "Nairobi Securities Exchange",
      "TransCentury",
      "Home Afrika",
      "Cytonn Investments",
      "CIC Group",
    ],
  },
  Education: {
    label: "Education & Academy",
    companies: [
      "Strathmore University",
      "USIU",
      "KU",
      "Moringa School",
      "Zeraki",
      "Ministry of Education",
      "University of Nairobi",
      "JKUAT",
      "Mount Kenya University",
      "Riara Group",
      "Nova Pioneer",
      "African Leadership University",
    ],
  },
  Health: {
    label: "Health & Pharma",
    companies: [
      "Amref Health Africa",
      "Aga Khan Hospital",
      "Nairobi Hospital",
      "KEMRI",
      "NHIF",
      "Ministry of Health",
      "Marie Stopes",
      "PS Kenya",
      "Gertrude's Children's Hospital",
      "MP Shah Hospital",
      "Karen Hospital",
      "Equity Afia",
    ],
  },
  Retail: {
    label: "Retail & Consumer",
    companies: [
      "Naivas",
      "Quickmart",
      "Carrefour Kenya",
      "Copia Kenya",
      "Chandarana Foodplus",
      "Kikuu",
    ],
  },
  PublicSector: {
    label: "Public Sector & Parastatals",
    companies: [
      "Kenya Revenue Authority",
      "Kenya Bureau of Standards",
      "NTSA",
      "Huduma Kenya",
      "Central Bank of Kenya",
      "Judiciary of Kenya",
      "Parliament of Kenya",
      "EACC",
      "Office of the Auditor General",
      "National Hospital Insurance Fund",
    ],
  },
  scraped: {
    label: "From Scrapes",
    companies: [],
  },
};

export const ALL_ROLE_LABELS = ROLE_CATALOG.map((r) => r.label);

export function searchRoleSuggestions(query: string, limit = 16): { label: string; matchedVia?: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return ROLE_CATALOG.slice(0, limit).map((r) => ({ label: r.label }));
  }

  const scored: { label: string; matchedVia?: string; score: number }[] = [];

  for (const entry of ROLE_CATALOG) {
    const labelLower = entry.label.toLowerCase();
    if (labelLower.includes(q)) {
      scored.push({ label: entry.label, score: labelLower.startsWith(q) ? 3 : 2 });
      continue;
    }
    for (const alias of entry.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower.includes(q) || q.includes(aliasLower)) {
        scored.push({ label: entry.label, matchedVia: alias, score: aliasLower.startsWith(q) ? 2 : 1 });
        break;
      }
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: { label: string; matchedVia?: string }[] = [];
  for (const s of scored) {
    if (seen.has(s.label)) continue;
    seen.add(s.label);
    out.push({ label: s.label, matchedVia: s.matchedVia });
    if (out.length >= limit) break;
  }
  return out;
}

export function companiesForSectors(sectorIds: CompanySectorId[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of sectorIds) {
    for (const c of COMPANY_SECTORS[id]?.companies ?? []) {
      if (!seen.has(c)) {
        seen.add(c);
        out.push(c);
      }
    }
  }
  return out;
}

export function joinCsv(values: string[]): string {
  return values.join(", ");
}

export function parseCsv(s: string): string[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

export function mergeCsv(existing: string, additions: string[]): string {
  const set = new Set(parseCsv(existing).map((x) => x.toLowerCase()));
  const merged = [...parseCsv(existing)];
  for (const a of additions) {
    if (!set.has(a.toLowerCase())) {
      set.add(a.toLowerCase());
      merged.push(a);
    }
  }
  return joinCsv(merged);
}
