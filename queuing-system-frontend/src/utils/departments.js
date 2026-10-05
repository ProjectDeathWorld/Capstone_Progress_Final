export const DEPARTMENTS = [
  { name: 'Cashier', label: 'Accounting / Cashier', position: 'cashier', type: 'CS', storedType: 'C', icon: 'payments', aliases: ['Accounting', 'accounting', 'Accounting / Cashier', 'accounting / cashier'] },
  { name: 'Registrar', position: 'registrar', type: 'RT', storedType: 'R', icon: 'folder', aliases: [] },
  { name: 'ITM', position: 'itm', type: 'ITM', storedType: 'ITM', icon: 'computer', aliases: [] },
  { name: 'Admission', label: 'Assessment', position: 'admission', type: 'ADM', storedType: 'ADM', icon: 'school', aliases: [] },
]

export const departmentFor = value => DEPARTMENTS.find(department =>
  [department.name, department.label, department.position, department.type, department.storedType, ...(department.aliases || [])]
    .filter(alias => typeof alias === 'string')
    .some(alias => alias.toLowerCase() === String(value || '').toLowerCase()))

export const enabledDepartments = settings => Array.isArray(settings?.enabledDepartments)
  ? [...new Set(settings.enabledDepartments.map(value => departmentFor(value)?.name || value))]
  : ['Cashier', 'Registrar']

export const isHeadAdminUser = (user) => {
  if (!user) return false
  if (user.is_head_admin) return true
  const role = String(user.role || '').trim().toLowerCase()
  return role === 'admin' && !user.position && !user.is_dept_admin
}

export const isDeptAdminUser = (user) => {
  if (!user) return false
  if (user.is_dept_admin) return true
  const role = String(user.role || '').trim().toLowerCase()
  return role === 'dept_admin' || (role === 'admin' && Boolean(user.position))
}

export const getDepartmentDisplayName = (dept) => {
  const d = String(dept || '').trim().toLowerCase()
  if (d === 'cashier' || d === 'accounting' || d.includes('cashier')) return 'Accounting / Cashier'
  if (d === 'registrar') return 'Registrar'
  if (d === 'itm') return 'ITM'
  if (d === 'admission') return 'Admission'
  return dept || 'Department'
}
