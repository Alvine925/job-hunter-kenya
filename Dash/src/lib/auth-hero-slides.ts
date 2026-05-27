import signin1 from "@/assets/auth-hero-signin-1.png";
import signin2 from "@/assets/auth-hero-signin-2.png";
import signin3 from "@/assets/auth-hero-signin-3.png";
import signup1 from "@/assets/auth-hero-signup-1.png";
import signup2 from "@/assets/auth-hero-signup-2.png";
import signup3 from "@/assets/auth-hero-signup-3.png";

export type AuthHeroSlide = {
  image: string;
  title: string;
  body: string;
};

export const SIGNIN_HERO_SLIDES: AuthHeroSlide[] = [
  {
    image: signin1,
    title: "Land the right role in Kenya, faster.",
    body: "Smart matching, tailored applications, and jobs from the boards you already trust — all in one place.",
  },
  {
    image: signin2,
    title: "Your search, organised.",
    body: "Track applications, monitor boards, and apply with a CV and cover letter tuned to each role.",
  },
  {
    image: signin3,
    title: "Built for how you actually job-hunt.",
    body: "From BrighterMonday to LinkedIn — Tellus brings listings and apply flows together.",
  },
];

export const SIGNUP_HERO_SLIDES: AuthHeroSlide[] = [
  {
    image: signup1,
    title: "Your next opportunity starts here.",
    body: "Upload your CV once, match to live roles, and apply by email or form — Tellus handles the heavy lifting.",
  },
  {
    image: signup2,
    title: "Stand out with tailored applications.",
    body: "AI-assisted cover letters and templates that sound like you — not a generic template.",
  },
  {
    image: signup3,
    title: "Jobs across Kenya, one dashboard.",
    body: "Discover roles from top boards, score your fit, and apply without juggling ten tabs.",
  },
];
