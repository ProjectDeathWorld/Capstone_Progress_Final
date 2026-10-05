import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
const output = path.resolve('../tmp/pdfs')
mkdirSync(output, {recursive:true})
execFileSync('php', ['artisan','test','--compact','--filter=QueueReportTest'], {
  cwd:path.resolve('../queuing-system-backend'), stdio:'inherit',
  env:{...process.env, REPORT_QA_OUTPUT:path.join(output,'test-database-report.json')}
})
