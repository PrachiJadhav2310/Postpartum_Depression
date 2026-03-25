/* eslint-disable no-console */
require('dotenv').config();

/**
 * Offline evaluation helper for PPD prediction quality.
 *
 * Usage:
 *   node scripts/evaluate-ppd-model.js ./data/ppd-labeled-samples.json
 *
 * Expected JSON format:
 * [
 *   {
 *     "assessmentData": { ...same shape used by /detailed-assessment... },
 *     "label": "low|mild|moderate|high|critical"
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');
const { predictPPD } = require('../services/bertPPDPredictionService');

const ORDER = ['low', 'mild', 'moderate', 'high', 'critical'];

const toIndex = (label) => {
  const i = ORDER.indexOf(label);
  return i === -1 ? null : i;
};

const main = async () => {
  const dataPathArg = process.argv[2];
  if (!dataPathArg) {
    console.error('Missing dataset path.');
    console.error('Example: node scripts/evaluate-ppd-model.js ./data/ppd-labeled-samples.json');
    process.exit(1);
  }

  const absolutePath = path.isAbsolute(dataPathArg)
    ? dataPathArg
    : path.resolve(process.cwd(), dataPathArg);

  if (!fs.existsSync(absolutePath)) {
    console.error(`Dataset not found: ${absolutePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absolutePath, 'utf-8');
  const samples = JSON.parse(raw);
  if (!Array.isArray(samples) || samples.length === 0) {
    console.error('Dataset must be a non-empty array.');
    process.exit(1);
  }

  let correct = 0;
  let total = 0;
  let mae = 0;

  const confusion = {};
  ORDER.forEach((actual) => {
    confusion[actual] = {};
    ORDER.forEach((pred) => {
      confusion[actual][pred] = 0;
    });
  });

  for (const sample of samples) {
    if (!sample?.assessmentData || !sample?.label) continue;
    const actual = String(sample.label).toLowerCase();
    if (!ORDER.includes(actual)) continue;

    // Synthetic userId for evaluation context.
    const prediction = await predictPPD('00000000-0000-0000-0000-000000000000', sample.assessmentData);
    const predicted = String(prediction.riskLevel || 'low').toLowerCase();

    total += 1;
    if (predicted === actual) correct += 1;
    if (confusion[actual] && confusion[actual][predicted] !== undefined) {
      confusion[actual][predicted] += 1;
    }

    const ai = toIndex(actual);
    const pi = toIndex(predicted);
    if (ai !== null && pi !== null) {
      mae += Math.abs(ai - pi);
    }
  }

  if (total === 0) {
    console.error('No valid samples found in dataset.');
    process.exit(1);
  }

  const accuracy = (correct / total) * 100;
  const meanAbsError = mae / total;

  console.log('\n=== PPD Model Evaluation ===');
  console.log(`Samples evaluated: ${total}`);
  console.log(`Exact risk-level accuracy: ${accuracy.toFixed(2)}%`);
  console.log(`Ordinal mean absolute error: ${meanAbsError.toFixed(3)} (0 is best)\n`);

  console.log('Confusion matrix (actual -> predicted):');
  console.table(confusion);
};

main().catch((err) => {
  console.error('Evaluation failed:', err);
  process.exit(1);
});
