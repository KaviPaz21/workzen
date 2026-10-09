import { bucketDefinitions } from '../data/buckets'
import type { Candidate, CvScore, JobDescription, Vacancy } from '../types'

export interface ExportRow {
  candidate: Candidate
  score: CvScore
  batchName: string
}

interface ExportInput {
  vacancy: Vacancy
  jd: JobDescription | undefined
  rows: ExportRow[]
  scopeLabel: string
  count: number
}

function fileSafe(value: string) {
  return value.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'export'
}

export function sortByScore(rows: ExportRow[]) {
  return [...rows].sort((a, b) => b.score.overall_score - a.score.overall_score || a.candidate.full_name.localeCompare(b.candidate.full_name))
}

export async function downloadExcel({ vacancy, jd, rows, scopeLabel, count }: ExportInput) {
  const { default: ExcelJS } = await import('exceljs')
  const top = sortByScore(rows).slice(0, count)

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'WorkZen RecruiteOne'
  workbook.created = new Date()

  const sheet = workbook.addWorksheet('Candidates', { views: [{ state: 'frozen', ySplit: 1, xSplit: 2 }] })
  const columns = [
    { header: 'Rank', key: 'rank', width: 7 },
    { header: 'Name', key: 'name', width: 26 },
    { header: 'Email', key: 'email', width: 28 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Current title', key: 'title', width: 24 },
    { header: 'CV file', key: 'file', width: 28 },
    { header: 'Source', key: 'source', width: 16 },
    { header: 'Batch', key: 'batch', width: 20 },
    { header: 'Overall score', key: 'overall', width: 13 },
    { header: 'Recommendation', key: 'recommendation', width: 18 },
    ...bucketDefinitions.map(({ key, label }) => ({ header: `${label} score`, key: `score_${key}`, width: 14 })),
    ...bucketDefinitions.map(({ key, label }) => ({ header: `${label} reasoning`, key: `reason_${key}`, width: 52 })),
    { header: 'AI summary', key: 'summary', width: 60 },
  ]
  sheet.columns = columns

  top.forEach(({ candidate, score, batchName }, index) => {
    const row: Record<string, string | number> = {
      rank: index + 1,
      name: candidate.full_name,
      email: candidate.email,
      phone: candidate.phone ?? '',
      title: candidate.current_title,
      file: candidate.file_name,
      source: candidate.source === 'application' ? 'Application link' : 'Upload',
      batch: batchName,
      overall: score.overall_score,
      recommendation: score.recommendation.replace(/_/g, ' '),
      summary: score.summary,
    }
    for (const benchmark of score.benchmarks) {
      row[`score_${benchmark.key}`] = benchmark.applicable ? benchmark.score : 'n/a'
      row[`reason_${benchmark.key}`] = benchmark.reasoning
    }
    const added = sheet.addRow(row)
    added.alignment = { vertical: 'top', wrapText: true }
  })

  const header = sheet.getRow(1)
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C0C12' } }
  header.alignment = { vertical: 'middle', wrapText: true }
  header.height = 32

  const summary = workbook.addWorksheet('Summary')
  summary.columns = [
    { header: 'Item', key: 'item', width: 26 },
    { header: 'Value', key: 'value', width: 50 },
  ]
  summary.addRows([
    { item: 'Vacancy', value: vacancy.title },
    { item: 'Job description', value: jd?.name ?? '' },
    { item: 'Role', value: jd?.role ?? '' },
    { item: 'Sector', value: jd?.sector ?? '' },
    { item: 'Level', value: jd?.level ?? '' },
    { item: 'Scope', value: scopeLabel },
    { item: 'Records exported', value: `${top.length} of ${rows.length} scored CVs` },
    { item: 'Exported on', value: new Date().toLocaleString() },
    { item: '', value: '' },
    { item: 'Benchmark', value: 'Weight set on the JD' },
    ...bucketDefinitions.map(({ key, label }) => ({ item: label, value: jd ? `${jd.weights[key]}%` : '' })),
  ])
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C0C12' } }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${fileSafe(vacancy.title)}-${fileSafe(scopeLabel)}-top-${top.length}.xlsx`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
  return top.length
}
