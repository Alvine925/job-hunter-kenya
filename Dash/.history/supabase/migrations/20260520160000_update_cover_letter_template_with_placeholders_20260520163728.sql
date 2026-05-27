-- Update cover letter template with the professional structure guide
-- This template serves as a structural reference guide for the AI agent

DELETE FROM public.templates 
WHERE type = 'cover_letter' AND is_default = true;

INSERT INTO public.templates (user_id, name, type, category, tone, content, is_default)
SELECT 
  profiles.user_id,
  'Professional Cover Letter Template' as name,
  'cover_letter' as type,
  'General' as category,
  'Formal' as tone,
  '[Date]

Hiring Manager
[Company Name]

Dear Hiring Manager,

# 1. Introduction

[Write a short professional introduction about who I am, my experience level, industry background, and the specific role I am applying for. Briefly mention my strongest professional areas.]

---

# 2. Why I Am Interested in the Role

[Explain why I want this role and why I am interested in this specific company. Show alignment between my goals, interests, and the company''s mission, products, culture, or industry.]

---

# 3. Why I Am Qualified

[Explain my qualifications, relevant work experience, technical skills, responsibilities, and achievements that directly match the job description. Include measurable results where possible.]

---

# 4. Value I Can Bring to the Company

[Explain how my skills and experience can help the company achieve its goals. Focus on impact, contribution, growth, efficiency, innovation, customer satisfaction, or problem-solving.]

---

# 5. Professional Qualities

[Describe my professional character, work ethic, communication style, leadership ability, adaptability, teamwork, or other soft skills that make me effective in a work environment.]

---

# 6. Closing Statement

[End the letter professionally by thanking the employer, expressing enthusiasm for the opportunity, and showing willingness to discuss further in an interview.]

Sincerely,
[Your Full Name]'
  as content,
  true as is_default
FROM public.profiles
ON CONFLICT (id) DO NOTHING;
