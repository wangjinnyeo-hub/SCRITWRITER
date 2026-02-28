import { useProjectStore } from '@/store/project/projectStore'
import type { SWFile } from '@/types'

export function restoreFile(transform: (file: SWFile) => SWFile) {
  const file = useProjectStore.getState().file
  if (!file) return
  useProjectStore.setState({ file: transform(file), isDirty: true })
}
