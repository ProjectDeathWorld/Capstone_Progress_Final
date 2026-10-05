export function completedOfficeShares(rows) {
  const offices = ['Cashier', 'Registrar', 'ITM', 'Admission'].map(office => {
    const count = Number(rows.find(row => row.office === office)?.completed ?? 0)
    return { office, completed: Number.isFinite(count) ? Math.max(0, count) : 0 }
  })
  const total = offices.reduce((sum, row) => sum + row.completed, 0)
  return { total, offices: offices.map(row => ({ ...row, percentage: total ? row.completed / total * 100 : 0 })) }
}
