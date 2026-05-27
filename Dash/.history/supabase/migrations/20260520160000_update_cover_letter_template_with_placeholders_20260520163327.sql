-- Update cover letter template with dynamic placeholders from CV data
-- This template uses {{PLACEHOLDER}} syntax which will be replaced by the AI agent with actual CV data

DELETE FROM public.templates 
WHERE type = 'cover_letter' AND is_default = true;

INSERT INTO public.templates (user_id, name, type, category, tone, content, is_default)
SELECT 
  auth.users.id as user_id,
  'Professional Cover Letter Template' as name,
  'cover_letter' as type,
  'General' as category,
  'Formal' as tone,
  '[Date]

Hiring Manager
{{COMPANY_NAME}}

Dear Hiring Manager,

# 1. Introduction

I am a {{PROFESSION}} with {{YEARS_OF_EXPERIENCE}} years of experience in {{INDUSTRY_SPECIALIZATION}}. I am applying for the {{POSITION}} role at {{COMPANY_NAME}}. Throughout my career, I have developed strong skills in {{KEY_SKILLS}}.

---

# 2. Why I Am Interested in the Role

I am particularly interested in this opportunity because {{COMPANY_NAME}} has built a strong reputation for {{COMPANY_MISSION_OR_VALUES}}. I admire the company''s commitment to {{COMPANY_STRENGTHS}}, and I believe this role aligns perfectly with my professional goals and passion for {{CAREER_PASSION}}.

---

# 3. Why I Am Qualified

In my previous roles, I have successfully {{MAJOR_ACHIEVEMENTS}}. I have demonstrated expertise in {{CORE_COMPETENCIES}} and have consistently delivered results including {{QUANTIFIABLE_RESULTS}}. My technical proficiency includes {{TECHNICAL_SKILLS}}, which directly align with your requirements for this position.

---

# 4. Value I Can Bring to the Company

I am confident that my experience and skills would enable me to contribute significantly to {{COMPANY_NAME}}''s objectives. Specifically, I can {{UNIQUE_VALUE_PROPOSITION}}, improve {{BUSINESS_IMPACT_AREA}}, and help drive {{STRATEGIC_OUTCOMES}} through {{METHODOLOGY_OR_APPROACH}}.

---

# 5. Professional Qualities

Professionally, I am known for {{PROFESSIONAL_ATTRIBUTES}}. I work effectively both independently and within collaborative teams, and I consistently approach projects with {{WORK_ETHIC_TRAITS}} and a strong commitment to achieving {{SUCCESS_MEASURE}}.

---

# 6. Closing Statement

I would welcome the opportunity to further discuss how my experience and skills align with the needs of {{COMPANY_NAME}}. Thank you for considering my application. I look forward to the possibility of contributing to your organization and becoming part of your team.

Sincerely,
{{FULL_NAME}}'
  as content,
  true as is_default
FROM auth.users
WHERE id IN (SELECT DISTINCT user_id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
