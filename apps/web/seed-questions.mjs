import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  "https://yadcbqmqpcvxjlokjndl.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhZGNicW1xcGN2eGpsb2tqbmRsIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ5OTczOCwiZXhwIjoyMDkwMDc1NzM4fQ.nXoNkKnLEfUsqtB37n6_aEMKUt8FA7UHjCOafbw04yw",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TEST_ID = "9882821f-be19-4614-b96d-5bad2125647d";

const questions = [
  { content: "A train travels 360 km in 4 hours. What is its speed in m/s?", options: { A: "25 m/s", B: "90 m/s", C: "40 m/s", D: "100 m/s" }, correct: "A", explanation: "360km/4h = 90km/h = 25 m/s", tags: ["speed"] },
  { content: "A shopkeeper buys for Rs.800 and sells for Rs.1000. Profit percentage?", options: { A: "20%", B: "25%", C: "30%", D: "15%" }, correct: "B", explanation: "Profit=200; 200/800x100=25%", tags: ["profit"] },
  { content: "If 15% of x is 45, find x.", options: { A: "200", B: "250", C: "300", D: "350" }, correct: "C", explanation: "15/100 x x = 45; x=300", tags: ["percentage"] },
  { content: "Ratio of two numbers is 3:5. Sum is 160. Find the larger number.", options: { A: "60", B: "80", C: "90", D: "100" }, correct: "D", explanation: "5/8 x 160 = 100", tags: ["ratio"] },
  { content: "A can do work in 12 days, B in 18 days. Together they complete it in?", options: { A: "6.2 days", B: "7.2 days", C: "8 days", D: "9 days" }, correct: "B", explanation: "1/12+1/18=5/36; time=36/5=7.2 days", tags: ["work"] },
  { content: "Simple interest on Rs.5000 at 8% per annum for 3 years?", options: { A: "Rs.1200", B: "Rs.1500", C: "Rs.1800", D: "Rs.2000" }, correct: "A", explanation: "SI=5000x8x3/100=1200", tags: ["si"] },
  { content: "If 2x + 3y = 12 and x - y = 1, find x.", options: { A: "2", B: "3", C: "4", D: "5" }, correct: "B", explanation: "x=y+1; 2(y+1)+3y=12; y=2; x=3", tags: ["algebra"] },
  { content: "Find the LCM of 12, 18 and 24.", options: { A: "36", B: "48", C: "72", D: "96" }, correct: "C", explanation: "LCM(12,18,24)=72", tags: ["lcm"] },
  { content: "What percent of 250 is 75?", options: { A: "25%", B: "28%", C: "30%", D: "32%" }, correct: "C", explanation: "75/250 x 100 = 30%", tags: ["percentage"] },
  { content: "A pipe fills a tank in 8 hours, another empties it in 12 hours. Time to fill if both open?", options: { A: "20 hours", B: "24 hours", C: "30 hours", D: "36 hours" }, correct: "B", explanation: "Net=1/8-1/12=1/24; time=24 hours", tags: ["pipes"] },
  { content: "Average of 5 numbers is 40. One is removed; average becomes 35. Number removed?", options: { A: "55", B: "60", C: "65", D: "70" }, correct: "B", explanation: "Total=200; 4x35=140; removed=60", tags: ["average"] },
  { content: "Car goes A to B at 60 km/h, returns at 40 km/h. Average speed?", options: { A: "48 km/h", B: "50 km/h", C: "52 km/h", D: "54 km/h" }, correct: "A", explanation: "2x60x40/100=48 km/h", tags: ["speed"] },
  { content: "Compound interest on Rs.2000 at 10% for 2 years?", options: { A: "Rs.400", B: "Rs.420", C: "Rs.440", D: "Rs.460" }, correct: "B", explanation: "2000x1.1x1.1-2000=420", tags: ["ci"] },
  { content: "8 men do work in 15 days. How many men to finish in 10 days?", options: { A: "10", B: "12", C: "14", D: "16" }, correct: "B", explanation: "8x15=nx10; n=12", tags: ["work"] },
  { content: "HCF of 48 and 64 is:", options: { A: "8", B: "12", C: "16", D: "24" }, correct: "C", explanation: "HCF(48,64)=16", tags: ["hcf"] },
  { content: "A number increased by 20% then decreased by 20%. Net change?", options: { A: "-4%", B: "0%", C: "+4%", D: "-2%" }, correct: "A", explanation: "1.2 x 0.8 = 0.96; net = -4%", tags: ["percentage"] },
  { content: "Cost price Rs.450, selling price Rs.405. Loss percentage?", options: { A: "8%", B: "9%", C: "10%", D: "12%" }, correct: "C", explanation: "Loss=45; 45/450x100=10%", tags: ["profit"] },
  { content: "In how many ways can 5 people be seated in a row?", options: { A: "60", B: "100", C: "120", D: "150" }, correct: "C", explanation: "5! = 120", tags: ["permutation"] },
  { content: "Probability of getting a head when a fair coin is tossed?", options: { A: "1/4", B: "1/3", C: "1/2", D: "2/3" }, correct: "C", explanation: "P(head)=1/2", tags: ["probability"] },
  { content: "Sum of first 20 natural numbers?", options: { A: "190", B: "200", C: "210", D: "220" }, correct: "C", explanation: "n(n+1)/2 = 20x21/2 = 210", tags: ["series"] },
  { content: "Milk and water mixture is 4:1. Water in 25 litres?", options: { A: "4 L", B: "5 L", C: "6 L", D: "8 L" }, correct: "B", explanation: "1/5 x 25 = 5 L", tags: ["mixture"] },
  { content: "Two numbers ratio 5:7, product 1715. Smaller number?", options: { A: "25", B: "30", C: "35", D: "40" }, correct: "C", explanation: "5x x 7x=1715; x=7; 5x7=35", tags: ["ratio"] },
  { content: "Value of sqrt(0.0625)?", options: { A: "0.025", B: "0.25", C: "2.5", D: "0.0025" }, correct: "B", explanation: "sqrt(625/10000)=25/100=0.25", tags: ["roots"] },
  { content: "Age of A is twice B. 10 years ago A was 3 times B. Current age of B?", options: { A: "20", B: "25", C: "30", D: "35" }, correct: "A", explanation: "A=2B; 2B-10=3(B-10); B=20", tags: ["ages"] },
  { content: "Rs.12000 doubles in 6 years at SI. Rate?", options: { A: "12.5%", B: "16.67%", C: "20%", D: "25%" }, correct: "B", explanation: "R=100x12000/(12000x6)=16.67%", tags: ["si"] },
  { content: "Three AP numbers sum 21, product 280. Middle number?", options: { A: "5", B: "7", C: "9", D: "11" }, correct: "B", explanation: "3a=21; a=7", tags: ["series"] },
  { content: "20% discount reduces price by Rs.400. Original price?", options: { A: "Rs.1500", B: "Rs.1800", C: "Rs.2000", D: "Rs.2500" }, correct: "C", explanation: "20%=400; 100%=2000", tags: ["discount"] },
  { content: "Arrangements of letters in LEVEL?", options: { A: "15", B: "20", C: "30", D: "60" }, correct: "C", explanation: "5!/(2!x2!)=120/4=30", tags: ["permutation"] },
  { content: "Diagonal of a square is 14 root 2 cm. Its area?", options: { A: "196 cm2", B: "200 cm2", C: "256 cm2", D: "392 cm2" }, correct: "A", explanation: "Side=14; area=196 cm2", tags: ["geometry"] },
  { content: "What is 12.5% of 960?", options: { A: "100", B: "110", C: "120", D: "130" }, correct: "C", explanation: "12.5/100 x 960 = 120", tags: ["percentage"] },
];

async function run() {
  // Clear existing data
  console.log("Clearing old test questions...");
  await sb.from("questions").delete().eq("test_id", TEST_ID);
  console.log("Clearing old question bank...");
  await sb.from("question_bank").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  // Seed bank
  console.log("Seeding question bank...");
  for (const q of questions) {
    const { data: bq, error } = await sb
      .from("question_bank")
      .insert({ type: "mcq", category: "aptitude", difficulty: "medium", topic: "TCS Aptitude", content: q.content, explanation: q.explanation, tags: q.tags })
      .select("id").single();
    if (error || !bq) { console.warn("Bank insert error:", error?.message); continue; }
    await sb.from("question_bank_options").insert(
      Object.entries(q.options).map(([key, content]) => ({ question_id: bq.id, option_key: key, content, is_correct: key === q.correct }))
    );
  }

  // Seed test
  console.log("Seeding test questions...");
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const { data: tq, error } = await sb
      .from("questions")
      .insert({ test_id: TEST_ID, question_number: i + 1, type: "mcq", category: "aptitude", difficulty: "medium", content: q.content, marks: 1, negative_marks: 0.25, explanation: q.explanation, tags: q.tags })
      .select("id").single();
    if (error || !tq) { console.warn("Test insert error:", error?.message); continue; }
    await sb.from("mcq_options").insert(
      Object.entries(q.options).map(([key, content]) => ({ question_id: tq.id, option_key: key, content, is_correct: key === q.correct }))
    );
  }

  // Final check
  const { count: qc } = await sb.from("questions").select("id", { count: "exact", head: true }).eq("test_id", TEST_ID);
  const { count: oc } = await sb.from("mcq_options").select("id", { count: "exact", head: true });
  const { count: bc } = await sb.from("question_bank").select("id", { count: "exact", head: true });
  const { count: boc } = await sb.from("question_bank_options").select("id", { count: "exact", head: true });

  console.log("\n=== VERIFICATION ===");
  console.log("Test:", qc, "questions,", oc, "options (expect 30, 120)");
  console.log("Bank:", bc, "questions,", boc, "options (expect 30, 120)");
  console.log(qc === 30 && oc === 120 ? "ALL OK" : "SOMETHING WRONG");
}

run().catch(console.error);
