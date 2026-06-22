// lib/branding.js
// ─────────────────────────────────────────────────────────────
// CLIENT-SAFE branding only — colours, text, mascot. NO secrets here
// (the system prompt + webhook live in lib/schools.js, server-side only).
// The active school is chosen by NEXT_PUBLIC_SCHOOL_ID (browser-visible,
// baked in at build time). Adding a school = copy a block, fill it in.
// ─────────────────────────────────────────────────────────────

export const BRANDING = {
  // ========================= BISPP (live) =========================
  bispp: {
    name: "Brightstar International",
    subName: "School of Phnom Penh",
    assistantName: "Brightstar Assistant",
    assistantTagline: "Fees · Admissions · Curriculum · Enrolment",
    mascot: "⭐",
    website: "https://brightstar.edu.kh",
    websiteLabel: "brightstar.edu.kh",
    phone: "015 905 789",
    footerText: "Brightstar International School of Phnom Penh",
    placeholder:
      "Ask about fees, enrolment, curriculum... / សួរអំពីថ្លៃ ការចុះឈ្មោះ...",
    colors: {
      primary: "#1565c0",
      primaryDark: "#0d47a1",
      primaryLight: "#1976d2",
      accent: "#ffc107",
      topBar:
        "linear-gradient(90deg, #e53935, #fb8c00, #fdd835, #43a047, #1e88e5, #8e24aa)",
    },
    welcome:
      "Hello! 👋 Welcome to Brightstar International School of Phnom Penh.\n\nI'm your admissions assistant — I can help with school fees, our Cambridge curriculum, the enrolment process, and more.\n\nWhat's your name? And which grade level are you enquiring about?\n\n—\n\nសួស្តី! 👋 សូមស្វាគមន៍មកកាន់សាលាអន្តរជាតិ Brightstar។\n\nខ្ញុំអាចជួយអ្នកអំពីថ្លៃសិក្សា កម្មវិធីសិក្សា Cambridge ដំណើរការចុះឈ្មោះ និងព័ត៌មានផ្សេងៗ។",
    quickActions: [
      "What are the school fees?",
      "How do I enrol my child?",
      "Tell me about the 2-week free trial",
      "What curriculum do you follow?",
    ],
  },

  // ===================== Herrington (next client) =====================
  // Swap the placeholder colours, mascot, links, and welcome for Herrington's.
  herrington: {
    name: "Herrington School",
    subName: "Phnom Penh",
    assistantName: "Herrington Assistant",
    assistantTagline: "Fees · Admissions · VCE · Enrolment",
    mascot: "🎓", // swap for their mascot/emoji (or we can wire a logo image later)
    website: "https://herrington.edu.kh",
    websiteLabel: "herrington.edu.kh",
    phone: "0XX XXX XXX",
    footerText: "Herrington School",
    placeholder: "Ask about fees, enrolment, the VCE pathway...",
    colors: {
      // ↓ placeholders — replace with Herrington's real brand colours
      primary: "#1b4332",
      primaryDark: "#123026",
      primaryLight: "#2d6a4f",
      accent: "#c9a227",
      topBar: "linear-gradient(90deg, #1b4332, #2d6a4f, #c9a227)",
    },
    welcome:
      "Hello! 👋 Welcome to Herrington School.\n\nI'm your admissions assistant — I can help with school fees, the VCE pathway, the enrolment process, and more.\n\nWhat's your name? And which year level are you enquiring about?\n\n[ add the Khmer version here ]",
    quickActions: [
      "What are the school fees?",
      "Tell me about the VCE pathway",
      "How do I enrol my child?",
      "What year levels do you offer?",
    ],
  },

  // To add a third (your max): copy the herrington block, rename the key.
};

export function getBranding() {
  const id = process.env.NEXT_PUBLIC_SCHOOL_ID || "bispp";
  return BRANDING[id] || BRANDING.bispp;
}
