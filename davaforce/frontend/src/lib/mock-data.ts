export type Candidate = {
  id: string;
  name: string;
  role: string;
  experience: string;
  availability: string;
  match: number;
  currentProject: string;
  projectMatch: number;
  location: string;
  grade: string;
  skills: string[];
  avatarUrl: string;
};

const portraitSeeds = [
  "Rahul", "Karthik", "Sneha", "Vikram", "Ananya",
  "Manoj", "Pooja", "Arjun", "Deepak", "Priya",
  "Anya", "Lukas", "Maria", "Diego", "Sofia",
  "Noah", "Liam", "Olivia", "Ethan", "Mia",
];

const avatar = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=ffeeea,e8eaeb,f4f6f7`;

export const candidates: Candidate[] = [
  { id: "e1", name: "Rahul Verma", role: "Software Engineer", experience: "5.2 yrs", availability: "Now", match: 94, currentProject: "Internal Tool Revamp", projectMatch: 50, location: "Bangalore", grade: "SE3", skills: ["Java", "Spring Boot", "AWS", "REST API"], avatarUrl: avatar("Rahul Verma") },
  { id: "e2", name: "Karthik R", role: "Software Engineer", experience: "4.1 yrs", availability: "10 Days", match: 92, currentProject: "CRM Enhancement", projectMatch: 40, location: "Bangalore", grade: "SE3", skills: ["Java", "Spring Boot", "Kafka"], avatarUrl: avatar("Karthik R") },
  { id: "e3", name: "Sneha Iyer", role: "Software Engineer", experience: "3.8 yrs", availability: "15 Days", match: 90, currentProject: "Data Migration", projectMatch: 30, location: "Bangalore", grade: "SE2", skills: ["Java", "SQL", "REST API"], avatarUrl: avatar("Sneha Iyer") },
  { id: "e4", name: "Vikram Rao", role: "Software Engineer", experience: "6.0 yrs", availability: "Now", match: 89, currentProject: "Reporting Portal", projectMatch: 60, location: "Bangalore", grade: "SSE", skills: ["Java", "Spring", "Postgres"], avatarUrl: avatar("Vikram Rao") },
  { id: "e5", name: "Ananya Singh", role: "Software Engineer", experience: "3.5 yrs", availability: "20 Days", match: 87, currentProject: "API Platform", projectMatch: 50, location: "Bangalore", grade: "SE2", skills: ["Java", "Spring Boot"], avatarUrl: avatar("Ananya Singh") },
  { id: "e6", name: "Manoj N", role: "Software Engineer", experience: "4.3 yrs", availability: "Now", match: 86, currentProject: "DevOps Automation", projectMatch: 40, location: "Bangalore", grade: "SE3", skills: ["Java", "Docker", "AWS"], avatarUrl: avatar("Manoj N") },
  { id: "e7", name: "Pooja Shah", role: "Software Engineer", experience: "3.2 yrs", availability: "25 Days", match: 85, currentProject: "Mobile App", projectMatch: 30, location: "Bangalore", grade: "SE2", skills: ["Java", "Android"], avatarUrl: avatar("Pooja Shah") },
  { id: "e8", name: "Arjun Menon", role: "Software Engineer", experience: "4.7 yrs", availability: "12 Days", match: 84, currentProject: "Cloud Migration", projectMatch: 50, location: "Bangalore", grade: "SE3", skills: ["AWS", "Terraform", "Java"], avatarUrl: avatar("Arjun Menon") },
  { id: "e9", name: "Deepak S", role: "Software Engineer", experience: "3.6 yrs", availability: "18 Days", match: 83, currentProject: "E-commerce Platform", projectMatch: 40, location: "Bangalore", grade: "SE2", skills: ["Java", "Spring Boot"], avatarUrl: avatar("Deepak S") },
];

export type Opportunity = {
  id: string;
  client: string;
  name: string;
  domain: string;
  region: string;
  city: string;
  stage: "Discovery" | "Proposal" | "Negotiation" | "Won";
  probability: number;
  startDate: string;
  durationWeeks: number;
  rolesTotal: number;
  rolesFilled: number;
  status: "On Track" | "At Risk" | "Blocked";
};

export const opportunities: Opportunity[] = [
  { id: "OPP-1042", client: "NorthBank", name: "Core Banking Modernization", domain: "Financial Services", region: "EMEA", city: "London", stage: "Proposal", probability: 70, startDate: "2026-07-15", durationWeeks: 26, rolesTotal: 8, rolesFilled: 5, status: "At Risk" },
  { id: "OPP-1043", client: "Helio Retail", name: "Omnichannel Commerce Rebuild", domain: "Retail", region: "APAC", city: "Bangalore", stage: "Negotiation", probability: 85, startDate: "2026-07-01", durationWeeks: 18, rolesTotal: 6, rolesFilled: 6, status: "On Track" },
  { id: "OPP-1051", client: "MedCore", name: "Clinical Data Lakehouse", domain: "Healthcare", region: "NA", city: "Toronto", stage: "Discovery", probability: 40, startDate: "2026-08-10", durationWeeks: 32, rolesTotal: 10, rolesFilled: 2, status: "Blocked" },
  { id: "OPP-1058", client: "Atlas Mobility", name: "Driver Ops Platform v2", domain: "Mobility", region: "EMEA", city: "Berlin", stage: "Proposal", probability: 60, startDate: "2026-07-22", durationWeeks: 20, rolesTotal: 7, rolesFilled: 4, status: "On Track" },
  { id: "OPP-1063", client: "Pinewood Insurance", name: "Claims AI Pilot", domain: "Insurance", region: "NA", city: "Chicago", stage: "Won", probability: 100, startDate: "2026-06-30", durationWeeks: 12, rolesTotal: 5, rolesFilled: 3, status: "At Risk" },
  { id: "OPP-1071", client: "Lumen Media", name: "Creative Services Expansion", domain: "Media", region: "EMEA", city: "Amsterdam", stage: "Negotiation", probability: 75, startDate: "2026-07-08", durationWeeks: 16, rolesTotal: 4, rolesFilled: 4, status: "On Track" },
];

export type EwaRequest = {
  id: string;
  candidate: string;
  candidateAvatar: string;
  opportunity: string;
  role: string;
  fte: number;
  proposedStart: string;
  status: "Pending" | "Approved" | "Rejected" | "Awaiting Info";
  blockingReason?: string;
  approver: string;
  submitted: string;
};

export const ewaRequests: EwaRequest[] = [
  { id: "EWA-2201", candidate: "Rahul Verma", candidateAvatar: avatar("Rahul Verma"), opportunity: "Helio Retail — Omnichannel", role: "Senior Java Engineer", fte: 1.0, proposedStart: "2026-07-01", status: "Pending", approver: "Priya Sharma", submitted: "2026-06-22" },
  { id: "EWA-2199", candidate: "Sneha Iyer", candidateAvatar: avatar("Sneha Iyer"), opportunity: "NorthBank — Core Banking", role: "Software Engineer", fte: 0.6, proposedStart: "2026-07-15", status: "Awaiting Info", blockingReason: "Confirm partial-capacity overlap with current allocation", approver: "Daniel Cohen", submitted: "2026-06-20" },
  { id: "EWA-2195", candidate: "Vikram Rao", candidateAvatar: avatar("Vikram Rao"), opportunity: "Atlas Mobility — Driver Ops", role: "Senior Software Engineer", fte: 1.0, proposedStart: "2026-07-22", status: "Approved", approver: "Priya Sharma", submitted: "2026-06-18" },
  { id: "EWA-2191", candidate: "Manoj N", candidateAvatar: avatar("Manoj N"), opportunity: "Pinewood — Claims AI", role: "DevOps Engineer", fte: 0.8, proposedStart: "2026-06-30", status: "Rejected", blockingReason: "Grade mismatch — role requires SSE", approver: "Marta Ruiz", submitted: "2026-06-15" },
  { id: "EWA-2188", candidate: "Arjun Menon", candidateAvatar: avatar("Arjun Menon"), opportunity: "MedCore — Data Lakehouse", role: "Cloud Engineer", fte: 1.0, proposedStart: "2026-08-10", status: "Pending", approver: "Daniel Cohen", submitted: "2026-06-14" },
];

export type Recommendation = {
  id: string;
  opportunity: string;
  role: string;
  option: "Best Fit" | "Fastest Available" | "Balanced";
  members: { name: string; avatar: string; match: number; fte: number }[];
  avgMatch: number;
  fteGap: number;
  risks: string[];
  reasoning: string;
};

export const recommendations: Recommendation[] = [
  {
    id: "REC-501",
    opportunity: "Helio Retail — Omnichannel Commerce",
    role: "Java Engineering Pod (3 FTE)",
    option: "Best Fit",
    members: [
      { name: "Rahul Verma", avatar: avatar("Rahul Verma"), match: 94, fte: 1 },
      { name: "Karthik R", avatar: avatar("Karthik R"), match: 92, fte: 1 },
      { name: "Sneha Iyer", avatar: avatar("Sneha Iyer"), match: 90, fte: 1 },
    ],
    avgMatch: 92,
    fteGap: 0,
    risks: ["Karthik R releases in 10 days — confirms ramp-up"],
    reasoning: "All three candidates carry Spring Boot + AWS at SE3 grade with 3+ years retail domain history. Combined availability covers start date with one ramp-up week buffer.",
  },
  {
    id: "REC-502",
    opportunity: "Helio Retail — Omnichannel Commerce",
    role: "Java Engineering Pod (3 FTE)",
    option: "Fastest Available",
    members: [
      { name: "Rahul Verma", avatar: avatar("Rahul Verma"), match: 94, fte: 1 },
      { name: "Vikram Rao", avatar: avatar("Vikram Rao"), match: 89, fte: 1 },
      { name: "Manoj N", avatar: avatar("Manoj N"), match: 86, fte: 1 },
    ],
    avgMatch: 90,
    fteGap: 0,
    risks: ["Vikram Rao is SSE grade — over-grade for one slot"],
    reasoning: "All three are bench-now. Avg match drops 2 pts vs. Best Fit, but no waiting and no partial-capacity stitching needed.",
  },
  {
    id: "REC-503",
    opportunity: "NorthBank — Core Banking Modernization",
    role: "Cloud Architect (1 FTE)",
    option: "Balanced",
    members: [{ name: "Arjun Menon", avatar: avatar("Arjun Menon"), match: 84, fte: 1 }],
    avgMatch: 84,
    fteGap: 0,
    risks: ["Capability gap on Kubernetes (desired) — candidate has AWS + Terraform"],
    reasoning: "Only feasible candidate with cloud architect grade in EMEA who releases before opportunity start. Skills gap is in a desired (not required) skill.",
  },
];

export type Person = {
  id: string;
  name: string;
  avatar: string;
  role: string;
  grade: string;
  location: string;
  status: "Allocated" | "Bench" | "Partial Capacity";
  utilization: number;
  releaseDate: string | null;
  skills: string[];
};

export const people: Person[] = portraitSeeds.slice(0, 18).map((seed, i) => {
  const statuses: Person["status"][] = ["Allocated", "Bench", "Partial Capacity"];
  const grades = ["SE2", "SE3", "SSE", "TL", "PM"];
  const cities = ["Bangalore", "London", "Berlin", "Toronto", "Amsterdam", "Chicago"];
  const roleList = ["Software Engineer", "QA Engineer", "Cloud Engineer", "Designer", "Tech Lead"];
  const skillBank = ["Java", "Spring Boot", "AWS", "React", "TypeScript", "Kafka", "Postgres", "Terraform", "Python"];
  const status = statuses[i % 3];
  return {
    id: `EMP-${4100 + i}`,
    name: `${seed} ${"PQRSTUV"[i % 7]}.`,
    avatar: avatar(seed),
    role: roleList[i % roleList.length],
    grade: grades[i % grades.length],
    location: cities[i % cities.length],
    status,
    utilization: status === "Bench" ? 0 : status === "Partial Capacity" ? 40 + (i % 4) * 10 : 80 + (i % 3) * 5,
    releaseDate: status === "Allocated" ? `2026-0${7 + (i % 3)}-${10 + i}`.slice(0, 10) : null,
    skills: [skillBank[i % skillBank.length], skillBank[(i + 3) % skillBank.length], skillBank[(i + 5) % skillBank.length]],
  };
});

export const benchAging = [
  { weeks: "0–2 wks", count: 8 },
  { weeks: "2–4 wks", count: 11 },
  { weeks: "4–8 wks", count: 7 },
  { weeks: "8+ wks", count: 4 },
];

export const skillSupplyDemand = [
  { skill: "Java", supply: 62, demand: 48 },
  { skill: "React", supply: 41, demand: 55 },
  { skill: "AWS", supply: 38, demand: 47 },
  { skill: "Spring Boot", supply: 35, demand: 30 },
  { skill: "Kubernetes", supply: 14, demand: 28 },
  { skill: "Data Eng.", supply: 22, demand: 31 },
  { skill: "QA Auto.", supply: 29, demand: 22 },
];

export const upcomingAvailability = [
  { window: "Now", count: 30 },
  { window: "≤10 days", count: 22 },
  { window: "11–20 days", count: 18 },
  { window: "21–30 days", count: 14 },
  { window: "31–60 days", count: 26 },
];

export const examplePrompts = [
  "Show me available Java developers in Bangalore for next 30 days",
  "Find a team for a cloud migration project starting June 15",
  "Show bench resources with AWS skills",
  "Who are at risk due to high utilization?",
];

export const followUpPrompts = [
  "Build a team for a 6-month cloud migration project starting June 15",
  "Show QA engineers in Pune available in next 60 days",
  "Find DevOps engineers with AWS & Terraform skills",
  "Show resources at risk due to high utilization",
];
