import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { classifyWithBackoff } from '../src/modules/incident/aiClient';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * AI Evaluation Script
 *
 * Objectives:
 * 1. Load the "Golden Dataset" (multilingual).
 * 2. Run each incident text through the AI Service.
 * 3. Compare AI prediction with Ground Truth.
 * 4. Calculate Precision, Recall, and F1-Score (Macro & Weighted).
 * 5. Output a formatted report.
 */

interface GoldenRecord {
  id: string;
  text: string;
  expectedCategory: string;
  language: 'AMHARIC' | 'ENGLISH';
}

interface EvaluationResult {
  id: string;
  text: string;
  expected: string;
  predicted: string;
  isCorrect: boolean;
  language: 'AMHARIC' | 'ENGLISH';
}

const GOLDEN_DATASET_PATH = path.join(__dirname, '../../ai-service/data/golden_multilingual.csv');

async function loadGoldenDataset(): Promise<GoldenRecord[]> {
  const fileContent = fs.readFileSync(GOLDEN_DATASET_PATH, 'utf-8');
  const lines = fileContent.trim().split('\n');
  const records: GoldenRecord[] = [];

  // Skip header "id,text,category"
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Handle CSV parsing (assuming simple CSV, but respecting quotes)
    // Matches: "value" or value, separated by comma
    const matches = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g);

    // Fallback split if regex fails or simple structure
    // Since the view_file showed quotes around text and category:
    // 1,"Fire smoke...","FIRE"

    // A simple regex approach for this specific CSV format:
    // ^(\d+),"(.*?)","(.*?)"$
    const simpleMatch = line.match(/^(\d+),"(.*?)","(.*?)"$/);

    if (simpleMatch) {
      const text = simpleMatch[2];
      const isAmharic = /[\u1200-\u137F]/.test(text); // Basic Amharic range check
      records.push({
        id: simpleMatch[1],
        text: text,
        expectedCategory: simpleMatch[3],
        language: isAmharic ? 'AMHARIC' : 'ENGLISH',
      });
    } else {
      // Try fallback for unquoted or mixed
      const parts = line.split(',');
      if (parts.length >= 3) {
        const id = parts[0];
        // Reconstruct text if it contained commas and was split
        const category = parts[parts.length - 1].replace(/"/g, '');
        const text = parts
          .slice(1, parts.length - 1)
          .join(',')
          .replace(/^"|"$/g, '');

        const isAmharic = /[\u1200-\u137F]/.test(text);
        records.push({
          id,
          text,
          expectedCategory: category,
          language: isAmharic ? 'AMHARIC' : 'ENGLISH',
        });
      }
    }
  }
  return records;
}

function calculateMetrics(results: EvaluationResult[]) {
  const tp: Record<string, number> = {};
  const fp: Record<string, number> = {};
  const fn: Record<string, number> = {};
  const categories = new Set<string>();

  results.forEach((r) => {
    categories.add(r.expected);
    categories.add(r.predicted);

    if (r.expected === r.predicted) {
      tp[r.expected] = (tp[r.expected] || 0) + 1;
    } else {
      fp[r.predicted] = (fp[r.predicted] || 0) + 1;
      fn[r.expected] = (fn[r.expected] || 0) + 1;
    }
  });

  const categoryMetrics: any = {};
  let totalF1 = 0;
  let count = 0;

  categories.forEach((cat) => {
    const t = tp[cat] || 0;
    const f_p = fp[cat] || 0;
    const f_n = fn[cat] || 0;

    const precision = t + f_p === 0 ? 0 : t / (t + f_p);
    const recall = t + f_n === 0 ? 0 : t / (t + f_n);
    const f1 = precision + recall === 0 ? 0 : (2 * (precision * recall)) / (precision + recall);

    categoryMetrics[cat] = { precision, recall, f1, support: t + f_n };

    // Only average for categories that exist in expected (support > 0)
    if (t + f_n > 0) {
      totalF1 += f1;
      count++;
    }
  });

  const macroF1 = count === 0 ? 0 : totalF1 / count;
  const accuracy = results.filter((r) => r.isCorrect).length / results.length;

  return { categoryMetrics, macroF1, accuracy };
}

async function main() {
  console.log('📊 Loading Golden Dataset...');
  const records = await loadGoldenDataset();
  console.log(`✅ Loaded ${records.length} records.`);

  const results: EvaluationResult[] = [];

  console.log('🤖 Running AI Classification...');

  const startTime = Date.now();
  let processed = 0;

  for (const record of records) {
    process.stdout.write(`\rProcessing ${++processed}/${records.length}...`);

    try {
      // Identify language ID (optional, but good for context if the API accepts it)
      // The API payload: { text: "..." }
      const response = await classifyWithBackoff({ text: record.text });
      let predicted = response.predicted_category || response.category; // Handle different response structures

      // XMLR model might return labels like "LABEL_0", "LABEL_1" if map missing
      // Or might return specific keys.
      // Normalization:
      const normalize = (s: string) => s?.trim().toUpperCase();

      const expected = normalize(record.expectedCategory);
      let predNorm = normalize(predicted);

      // Mapping (adjust based on what the model actually outputs vs dataset)
      const LABEL_MAP: Record<string, string> = {
        ACCIDENT: 'TRAFFIC',
        TRAFFIC_ACCIDENT: 'TRAFFIC',
        FIRE_EMERGENCY: 'FIRE',
        MEDICAL_EMERGENCY: 'MEDICAL',
        HEALTH: 'MEDICAL',
        CRIME: 'POLICE',
        SECURITY: 'POLICE',
        PUBLIC_ORDER: 'POLICE',
        INFRASTRUCTURE: 'INFRASTRUCTURE',
        UTILITY: 'INFRASTRUCTURE',
        UNKNOWN: 'OTHER',
      };

      if (LABEL_MAP[predNorm]) {
        predNorm = LABEL_MAP[predNorm];
      }

      const isCorrect = predNorm === expected;

      results.push({
        id: record.id,
        text: record.text,
        expected: record.expectedCategory, // Keep original for display
        predicted: predicted, // Keep original for display
        isCorrect: isCorrect,
        language: record.language,
      });
    } catch (err: any) {
      if (err.response?.status === 422) {
        console.error(
          `\n❌ Validation Error ID ${record.id}:`,
          JSON.stringify(err.response.data.detail),
        );
      } else {
        console.error(`\n❌ Error processing ID ${record.id}:`, err.message);
      }
    }
  }

  const duration = (Date.now() - startTime) / 1000;
  console.log(`\n✅ Completed in ${duration.toFixed(2)}s`);

  // --- REPORT GENERATION ---

  console.log('\n======================================================');
  console.log('               AI MODEL EVALUATION REPORT             ');
  console.log('======================================================');
  console.log(`Dataset Size: ${records.length}`);
  console.log(`Model Endpoint: ${process.env.AI_ENDPOINT || 'Default'}`);
  console.log('------------------------------------------------------');

  const englishResults = results.filter((r) => r.language === 'ENGLISH');
  const amharicResults = results.filter((r) => r.language === 'AMHARIC');

  const overall = calculateMetrics(results);
  const englishMetrics = calculateMetrics(englishResults);
  const amharicMetrics = calculateMetrics(amharicResults);

  console.log(`\n🌍 OVERALL PERFORMANCE`);
  console.log(`Accuracy: ${(overall.accuracy * 100).toFixed(2)}%`);
  console.log(`Macro F1-Score: ${overall.macroF1.toFixed(4)}`);

  console.log(`\n🇺🇸 ENGLISH SUBSET (${englishResults.length} samples)`);
  console.log(`Accuracy: ${(englishMetrics.accuracy * 100).toFixed(2)}%`);
  console.log(`Macro F1-Score: ${englishMetrics.macroF1.toFixed(4)}`);

  console.log(`\n🇪🇹 AMHARIC SUBSET (${amharicResults.length} samples)`);
  console.log(`Accuracy: ${(amharicMetrics.accuracy * 100).toFixed(2)}%`);
  console.log(`Macro F1-Score: ${amharicMetrics.macroF1.toFixed(4)}`);

  console.log('\nDetailed Category Metrics (Overall):');
  console.table(
    Object.entries(overall.categoryMetrics).reduce((acc: any, [cat, m]: any) => {
      acc[cat] = {
        Precision: m.precision.toFixed(3),
        Recall: m.recall.toFixed(3),
        F1: m.f1.toFixed(3),
        Support: m.support,
      };
      return acc;
    }, {}),
  );
}

main().catch(console.error);
