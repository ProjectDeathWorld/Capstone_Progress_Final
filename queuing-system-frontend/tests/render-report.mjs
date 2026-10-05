import { readFileSync } from 'node:fs'
import { createReportPdf } from '../src/utils/reportPdf.js'
for (const [suffix, output] of [['','test-database-report'],['.stress.json','test-database-stress'],['.empty.json','test-database-empty']]) {
  const data = JSON.parse(readFileSync(`../tmp/pdfs/test-database-report.json${suffix}`, 'utf8'))
  const doc = createReportPdf(data)
  doc.save(`../tmp/pdfs/${output}.pdf`)
  console.log(`${output}: ${doc.getNumberOfPages()} pages; ${data.report_summary.tickets_issued} test-database tickets`)
}
