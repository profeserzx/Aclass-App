// Kenya runs two curricula side by side right now: the older 8-4-4 system
// (Standard 1-8, then Form 1-4) and the newer CBC (Grade 1-12, split into
// primary/junior/senior secondary). A school might be either, or a mixed
// campus — so instead of asking a school to pick one system up front, we
// just offer both grouped together wherever a grade level is chosen, plus a
// free-text override for anything unusual (a stream name, a nursery level
// not listed, etc).
export const CURRICULUM_GRADE_GROUPS: { label: string; levels: string[] }[] = [
  {
    label: "CBC — Pre-Primary",
    levels: ["PP1", "PP2"],
  },
  {
    label: "CBC — Primary",
    levels: ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"],
  },
  {
    label: "CBC — Junior Secondary",
    levels: ["Grade 7", "Grade 8", "Grade 9"],
  },
  {
    label: "CBC — Senior Secondary",
    levels: ["Grade 10", "Grade 11", "Grade 12"],
  },
  {
    label: "8-4-4 — Primary",
    levels: [
      "Standard 1",
      "Standard 2",
      "Standard 3",
      "Standard 4",
      "Standard 5",
      "Standard 6",
      "Standard 7",
      "Standard 8",
    ],
  },
  {
    label: "8-4-4 — Secondary",
    levels: ["Form 1", "Form 2", "Form 3", "Form 4"],
  },
];
