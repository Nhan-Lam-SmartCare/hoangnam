const fs = require('fs');

const po = fs.readFileSync('paymentOptions.txt', 'utf-8');
const rs = fs.readFileSync('summary.txt', 'utf-8');
const ft = fs.readFileSync('footer.txt', 'utf-8');

let lines = rs.split('\n');
let removed = 0;
while(lines.length > 0 && removed < 5) {
    if(lines[lines.length - 1].trim() === '</div>') {
        lines.pop();
        removed++;
    } else if (lines[lines.length - 1].trim() === '') {
        lines.pop();
    } else {
        break;
    }
}
let rsClean = lines.join('\n');

let ftLines = ft.split('\n');
let modalClose = '';
while(ftLines.length > 0) {
    if(ftLines[ftLines.length - 1].trim() === '</div>') {
        modalClose = ftLines.pop();
        break;
    } else if(ftLines[ftLines.length - 1].trim() === '') {
        ftLines.pop();
    } else {
        break;
    }
}
let ftClean = ftLines.join('\n');

const newContent = `
            </div> {/* End of Left Column Form */}

            {/* Right Column (Totals, Payment & Actions) */}
            <div className="w-full lg:w-[450px] xl:w-[450px] flex-shrink-0 flex flex-col bg-slate-50 dark:bg-slate-800 lg:border-l border-slate-200 dark:border-slate-700 h-full max-h-full min-h-0">
              <div className="flex-1 overflow-y-auto px-4 py-5 md:px-6 md:py-6 space-y-6 pb-24 lg:pb-0 relative border-b border-slate-200 dark:border-slate-700">
                
${rsClean}

                <div className="border-t border-slate-200 dark:border-slate-700 pt-6 mt-6">
${po}
                </div>
              </div>

${ftClean}
            </div> {/* End of Right Column */}
          </div> {/* End of Main Content Area Layout */}
        </div> {/* End of Modal Container */}
`;

fs.writeFileSync('new_payment_block.txt', newContent);
console.log('Built new_payment_block.txt');
