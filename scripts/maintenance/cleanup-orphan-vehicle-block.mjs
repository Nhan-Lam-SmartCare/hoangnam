import fs from "node:fs";

const filePath = "src/components/service/components/WorkOrderModal.tsx";
let source = fs.readFileSync(filePath, "utf8");

const start = `                <div className="space-y-2">
                          {customerVehicles.map((vehicle: Vehicle) => {`;

const end = `                <div className="space-y-2">
                  <div className="flex items-center justify-between">`;

const startIndex = source.indexOf(start);
const endIndex = source.indexOf(end, startIndex);

if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
  throw new Error("Cannot find orphan vehicle block range.");
}

source =
  source.slice(0, startIndex) +
  end +
  source.slice(endIndex + end.length);

fs.writeFileSync(filePath, source, "utf8");
console.log("Orphan vehicle block removed.");
