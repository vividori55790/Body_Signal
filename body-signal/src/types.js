/**
 * @typedef {Object} Condition
 * @property {string} id
 * @property {string} label - e.g. "Chronic Back Pain"
 * @property {string} bodyPart - e.g. "Lower Back"
 * @property {string} onsetDate - ISO Date string
 * @property {Log[]} logs
 */

/**
 * @typedef {Object} Log
 * @property {string} id
 * @property {string} date - ISO Date string
 * @property {number} intensity - 1-10
 * @property {string} medication - Text
 * @property {string} treatment - Text
 */

export const MOCK_CONDITIONS = []; // Placeholder if needed
