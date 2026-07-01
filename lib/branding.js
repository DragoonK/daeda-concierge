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

  // ===================== Herrington (client #2) =====================
  herrington: {
    name: "Herrington International",
    subName: "School",
    assistantName: "Herrington Assistant",
    assistantTagline: "Curriculum · Campus · Admissions · Enrolment",
    mascot: "🎓",
    website: "https://www.his.edu.kh",
    websiteLabel: "his.edu.kh",
    phone: "(+855) 85 668 822",
    footerText: "Herrington International School",
    placeholder:
      "Ask about our curriculum, campus, admissions... / សួរអំពីកម្មវិធីសិក្សា...",
    colors: {
      primary: "#0f2c4c",       // deep navy
      primaryDark: "#0a1f36",
      primaryLight: "#1c4a7a",
      accent: "#c9a227",         // gold
      topBar: "linear-gradient(90deg, #0f2c4c, #1c4a7a, #c9a227)",
    },
    welcome:
      "Hello! 👋 Welcome to Herrington International School.\n\nI'm your admissions assistant — I can help you learn about our Cambridge curriculum, our campus in Borey Peng Huoth, and how to enrol.\n\nWhat's your name? And which year level are you enquiring about?\n\n—\n\nសួស្តី! 👋 សូមស្វាគមន៍មកកាន់សាលាអន្តរជាតិ Herrington។\n\nខ្ញុំអាចជួយអ្នកអំពីកម្មវិធីសិក្សា Cambridge បរិវេណសាលា និងដំណើរការចុះឈ្មោះ។ តើអ្នកឈ្មោះអ្វី? ហើយកូនរបស់អ្នកនៅកម្រិតថ្នាក់ណា?",
    quickActions: [
      "What curriculum do you follow?",
      "Where is the campus?",
      "How do I enrol my child?",
      "What year levels do you offer?",
    ],
  },

  // ===================== CIA FIRST (client #3) =====================
  ciafirst: {
    name: "CIA FIRST",
    subName: "International School",
    assistantName: "CIA FIRST Assistant",
    assistantTagline: "Programs · Campuses · Fees · Admissions",
    mascot: "🌐",
    website: "https://www.ciaschool.edu.kh",
    websiteLabel: "ciaschool.edu.kh",
    phone: "+855 99 200 011",
    footerText: "CIA FIRST International School",
    placeholder:
      "Ask about fees, campuses, AP program... / សួរអំពីថ្លៃ បរិវេណសាលា...",
    colors: {
      primary: "#0b3d91",       // CIA blue
      primaryDark: "#07285f",
      primaryLight: "#1e5fc0",
      accent: "#f5b301",         // gold/amber
      topBar: "linear-gradient(90deg, #07285f, #0b3d91, #1e5fc0)",
    },
    welcome:
      "Hello! 👋 Welcome to CIA FIRST International School.\n\nI'm your admissions assistant — I can help with our programs (FTI / FTK / FTC), our four campuses, school fees, and admissions. Tell me your child's grade and I'll point you to the right campus.\n\nWhat's your name? And which grade level are you enquiring about?\n\n—\n\nសួស្តី! 👋 សូមស្វាគមន៍មកកាន់សាលាអន្តរជាតិ CIA FIRST។\n\nខ្ញុំអាចជួយអ្នកអំពីកម្មវិធីសិក្សា បរិវេណសាលា ថ្លៃសិក្សា និងការចុះឈ្មោះ។ តើកូនរបស់អ្នកនៅថ្នាក់ណា?",
    quickActions: [
      "How much are the school fees?",
      "Which campus is right for my child?",
      "Tell me about the AP program",
      "How do I book a campus tour?",
    ],
  },

  // To add a fourth: copy a block above, rename the key, match it to lib/schools.js.
};

export function getBranding() {
  const id = process.env.NEXT_PUBLIC_SCHOOL_ID || "bispp";
  return BRANDING[id] || BRANDING.bispp;
}
