// Re-export from the new template system for backwards compatibility.
// Call sites should import buildBillHTML from this file and pass lang + template params.
export { buildBillHTML } from './templates/index';
