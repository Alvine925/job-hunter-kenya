-- Add default cover letter template
INSERT INTO public.templates (user_id, name, type, category, tone, content, is_default)
SELECT 
  profiles.user_id,
  'Professional Cover Letter Template' as name,
  'cover_letter' as type,
  'General' as category,
  'Formal' as tone,
  '[Date]

[Date]

Hiring Manager
[Company Name]

Dear Hiring Manager,

# 1. Introduction

[Write a short professional introduction about who I am, my experience level, industry background, and the specific role I am applying for. Briefly mention my strongest professional areas.]

What should go here:

* My profession or role
* Years of experience
* Industry or specialization
* Position I am applying for
* Main strengths or expertise

Example:
I am a digital marketing specialist with over 5 years of experience helping businesses grow their online presence and increase customer engagement. I am applying for the Marketing Manager position at ABC Company. Throughout my career, I have developed strong skills in social media strategy, content marketing, and brand growth.

---

# 2. Why I Am Interested in the Role

[Explain why I want this role and why I am interested in this specific company. Show alignment between my goals, interests, and the company’s mission, products, culture, or industry.]

What should go here:

* Why the role interests me
* Why I admire the company
* How the role aligns with my goals
* What attracts me to the organization

Example:
I am particularly interested in this opportunity because ABC Company has built a strong reputation for innovation and customer-focused solutions. I admire the company’s commitment to creativity and growth, and I believe this role aligns perfectly with my passion for developing impactful marketing campaigns.

---

# 3. Why I Am Qualified

[Explain my qualifications, relevant work experience, technical skills, responsibilities, and achievements that directly match the job description. Include measurable results where possible.]

What should go here:

* Previous work experience
* Relevant responsibilities
* Technical or professional skills
* Achievements and measurable results
* Leadership or project experience

Example:
In my previous role at XYZ Agency, I managed multiple digital campaigns for clients across different industries. I successfully increased social media engagement by 45% and helped improve lead generation through targeted advertising strategies. I also have experience using tools such as Google Analytics, Meta Ads Manager, and SEO platforms to optimize marketing performance.

---

# 4. Value I Can Bring to the Company

[Explain how my skills and experience can help the company achieve its goals. Focus on impact, contribution, growth, efficiency, innovation, customer satisfaction, or problem-solving.]

What should go here:

* How I can help the company
* Problems I can solve
* Value I bring to the team
* Outcomes I can contribute to

Example:
I believe my experience in digital strategy and audience engagement would allow me to contribute positively to ABC Company’s marketing objectives. My ability to analyze trends, develop creative campaigns, and improve customer engagement can help strengthen the company’s brand visibility and overall business growth.

---

# 5. Professional Qualities

[Describe my professional character, work ethic, communication style, leadership ability, adaptability, teamwork, or other soft skills that make me effective in a work environment.]

What should go here:

* Work ethic
* Communication skills
* Team collaboration
* Leadership qualities
* Adaptability
* Problem-solving abilities

Example:
Professionally, I am known for being proactive, adaptable, and detail-oriented. I work well both independently and within collaborative teams, and I consistently approach projects with professionalism, creativity, and a strong commitment to achieving results.

---

# 6. Closing Statement

[End the letter professionally by thanking the employer, expressing enthusiasm for the opportunity, and showing willingness to discuss further in an interview.]

What should go here:

* Appreciation for consideration
* Interest in an interview
* Positive closing statement
* Enthusiasm for the opportunity

Example:
I would welcome the opportunity to further discuss how my experience and skills align with the needs of your organization. Thank you for considering my application. I look forward to the possibility of contributing to ABC Company and becoming part of your team.

Sincerely,
[Your Full Name]
' as content,
  true as is_default
FROM public.profiles
ON CONFLICT (id) DO NOTHING;
