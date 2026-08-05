#!/usr/bin/env node

import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../data.js', import.meta.url), 'utf8');
const context = {};
vm.createContext(context);
vm.runInContext(`${source}; globalThis.__benchsy = {
  MODELS, SCORE_CATEGORIES, SOURCES, RESEARCH_DATE, RESEARCH_ISO
};`, context);

const { MODELS, SCORE_CATEGORIES, SOURCES, RESEARCH_DATE, RESEARCH_ISO } = context.__benchsy;
const research = JSON.parse(fs.readFileSync(new URL('../benchsy-research.json', import.meta.url), 'utf8'));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

check(MODELS.length === research.length,
  `data.js has ${MODELS.length} models but benchsy-research.json has ${research.length}`);
check(new Set(MODELS.map((model) => model.id)).size === MODELS.length, 'Model ids must be unique');
check(new Set(MODELS.map((model) => model.name)).size === MODELS.length, 'Model names must be unique');

const researchNames = new Set(research.map((model) => model.name));
MODELS.forEach((model) => {
  check(researchNames.has(model.name), `${model.name} is missing from benchsy-research.json`);
  check((model.inputPrice == null) === (model.outputPrice == null),
    `${model.name} must publish both token prices or neither`);
  if (model.communityBuild) {
    check(Boolean(model.communityBuild.name), `${model.name} community build needs a name`);
    check(/^https:\/\//.test(model.communityBuild.url),
      `${model.name} community build must use HTTPS`);
    if (model.communityBuild.creator) {
      check(Boolean(model.communityBuild.creator.name), `${model.name} community creator needs a name`);
      check(Boolean(model.communityBuild.creator.handle), `${model.name} community creator needs a handle`);
      check(/^https:\/\//.test(model.communityBuild.creator.url),
        `${model.name} community creator profile must use HTTPS`);
    }
    if (model.communityBuild.media) {
      check(/^https:\/\//.test(model.communityBuild.media.postUrl),
        `${model.name} community media post must use HTTPS`);
      check(/^https:\/\//.test(model.communityBuild.media.embedUrl),
        `${model.name} community media embed must use HTTPS`);
      check(Boolean(model.communityBuild.media.title),
        `${model.name} community media needs an accessible title`);
    }
    (model.communityBuild.tools ?? []).forEach((tool) => {
      check(Boolean(tool.name) && Boolean(tool.detail),
        `${model.name} community build tools need names and details`);
    });
  }
  SCORE_CATEGORIES.forEach((category) => {
    check(Number.isFinite(model.scores[category.key]), `${model.name} is missing ${category.key} score`);
    check(model.scores[category.key] >= 0 && model.scores[category.key] <= 100,
      `${model.name} ${category.key} score must be between 0 and 100`);
    check(Boolean(model.basis[category.key]), `${model.name} is missing ${category.key} evidence`);
  });
});

const modelNames = new Set(MODELS.map((model) => model.name));
research.forEach((model) => check(modelNames.has(model.name),
  `${model.name} exists in benchsy-research.json but not data.js`));

const weightTotal = SCORE_CATEGORIES.reduce((sum, category) => sum + category.weight, 0);
check(Math.abs(weightTotal - 1) < Number.EPSILON * 10, `Category weights total ${weightTotal}, not 1`);
SOURCES.flatMap((group) => group.items).forEach((item) => {
  check(/^https:\/\//.test(item.url), `Source must use HTTPS: ${item.name}`);
});

const parsedDate = new Date(`${RESEARCH_ISO}T00:00:00Z`);
check(!Number.isNaN(parsedDate.valueOf()), `Invalid RESEARCH_ISO: ${RESEARCH_ISO}`);
check(new Intl.DateTimeFormat('en-US', {
  month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
}).format(parsedDate) === RESEARCH_DATE, 'RESEARCH_DATE and RESEARCH_ISO disagree');

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Benchsy data valid: ${MODELS.length} models, ${SCORE_CATEGORIES.length} categories, ${research.length} research records.`);
}
