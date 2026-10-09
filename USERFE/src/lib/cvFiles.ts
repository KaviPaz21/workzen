import { apiGetBlob, apiPutForm } from '@/lib/api'

export async function saveCvFile(candidateId: string, file: File) {
  const form = new FormData()
  form.append('file', file, file.name)
  await apiPutForm(`/recruiteone/files/${candidateId}`, form)
}

export function loadCvFile(candidateId: string) {
  return apiGetBlob(`/recruiteone/files/${candidateId}`)
}
