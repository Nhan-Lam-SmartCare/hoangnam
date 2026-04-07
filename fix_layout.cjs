const fs = require('fs');

let text = fs.readFileSync('src/components/service/components/WorkOrderModal.tsx', 'utf-8');

const regex = /\{\/\*\s*Scrollable Content\s*\*\/\}\s*<div\s+className=["']px-4 py-5 md:px-6 md:py-6 space-y-6 overflow-y-auto flex-1 pb-24 md:pb-6["']>/g;

const newStr = `{/* Main Content Area Layout */}
          <div className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-hidden bg-slate-50/30 dark:bg-slate-900/10">
            {/* Left Column (Scrollable Form) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 lg:border-r border-slate-200 dark:border-slate-700 pb-24 lg:pb-6 bg-white dark:bg-slate-800">`;

text = text.replace(regex, newStr);

fs.writeFileSync('src/components/service/components/WorkOrderModal.tsx', text, 'utf-8');
console.log('Script updated scrollable content.');
